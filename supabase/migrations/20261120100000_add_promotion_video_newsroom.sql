-- Newsroom promotion videos reuse the post/file relationship while enforcing a
-- dedicated category and video-only binary metadata.
insert into public.boards (code, name, description, sort_order, is_active)
values ('promotion_video', '홍보·영상', '홍보 영상 게시물', 30, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

alter table public.posts drop constraint if exists posts_category_v2_check;
alter table public.posts add constraint posts_category_v2_check
  check (category is null or category in ('notice', 'association_news', 'promotion_video', 'member_news'));

alter table public.files drop constraint if exists files_file_kind_check;
alter table public.files add constraint files_file_kind_check
  check (file_kind in ('image', 'video', 'attachment'));
alter table public.files drop constraint if exists files_kind_mime_check;
alter table public.files add constraint files_kind_mime_check
  check (
    (file_kind <> 'image' or mime_type like 'image/%')
    and (file_kind <> 'video' or mime_type like 'video/%')
  );
alter table public.files drop constraint if exists files_kind_size_check;
alter table public.files add constraint files_kind_size_check
  check (
    (file_kind = 'image' and size_bytes <= 10485760)
    or (file_kind in ('video', 'attachment') and size_bytes <= 52428800)
  );

create or replace function public.sync_post_v2_legacy_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  board_code text;
begin
  if new.category is not null then
    select id into new.board_id from public.boards where code = new.category;
    if new.board_id is null then
      raise exception using errcode = '23514', message = 'matching legacy board is missing';
    end if;
    new.organization_id := new.institution_id;
    new.is_published := new.status = 'published';
  else
    select code into board_code from public.boards where id = new.board_id;
    if board_code in ('notice', 'association_news', 'promotion_video', 'member_news') then
      new.category := board_code;
      new.institution_id := case when board_code = 'member_news' then new.organization_id else null end;
      new.status := case when new.is_published then 'published' else 'draft' end;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.list_content_posts(
  p_page integer default 1, p_page_size integer default 10, p_category text default null,
  p_institution_id uuid default null, p_q text default null, p_status text default null,
  p_admin boolean default false
)
returns table (id uuid, category text, title text, institution jsonb, cover jsonb, is_pinned boolean,
  published_at timestamptz, status text, created_at timestamptz, updated_at timestamptz, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception using errcode = '22023', message = 'invalid pagination'; end if;
  if p_category is not null and p_category not in ('notice', 'association_news', 'promotion_video', 'member_news') then raise exception using errcode = '22023', message = 'invalid post category'; end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then raise exception using errcode = '22023', message = 'invalid content status'; end if;
  if p_admin and auth.role() <> 'authenticated' then raise exception using errcode = '42501', message = 'admin read requires authentication'; end if;
  return query select p.id, p.category, p.title,
    case when i.id is null then null else jsonb_build_object('id', i.id, 'institution_type', i.institution_type, 'name', i.name, 'logo', case when lf.id is null then null else jsonb_build_object('id', lf.id, 'file_kind', lf.file_kind, 'bucket_name', lf.bucket_name, 'storage_path', lf.storage_path, 'original_name', lf.original_name, 'mime_type', lf.mime_type, 'size_bytes', lf.size_bytes, 'width_px', lf.width_px, 'height_px', lf.height_px, 'alt_text', lf.alt_text, 'created_at', lf.created_at, 'updated_at', lf.updated_at) end) end,
    case when cf.id is null then null else jsonb_build_object('id', cf.id, 'file_kind', cf.file_kind, 'bucket_name', cf.bucket_name, 'storage_path', cf.storage_path, 'original_name', cf.original_name, 'mime_type', cf.mime_type, 'size_bytes', cf.size_bytes, 'width_px', cf.width_px, 'height_px', cf.height_px, 'alt_text', cf.alt_text, 'created_at', cf.created_at, 'updated_at', cf.updated_at) end,
    p.is_pinned, p.published_at, p.status, p.created_at, p.updated_at, count(*) over()
  from public.posts p left join public.institutions i on i.id = p.institution_id
  left join public.content_public_files lf on lf.id = i.logo_file_id
  left join lateral (select f.* from public.post_files pf join public.content_public_files f on f.id = pf.file_id where pf.post_id = p.id and pf.role = 'cover' order by pf.sort_order, pf.created_at, pf.file_id limit 1) cf on true
  where p.category is not null and (p_admin or (p.status = 'published' and p.published_at <= now()))
    and (p_category is null or p.category = p_category) and (p_institution_id is null or p.institution_id = p_institution_id)
    and (not p_admin or p_status is null or p.status = p_status)
    and (nullif(btrim(p_q), '') is null or p.title ilike '%' || btrim(p_q) || '%')
  order by p.is_pinned desc, p.published_at desc nulls last, p.created_at desc, p.id desc limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create or replace function public.list_admin_content_posts(
  p_page integer default 1, p_page_size integer default 10, p_category text default null,
  p_institution_id uuid default null, p_q text default null, p_status text default null,
  p_admin boolean default false, p_published_from timestamptz default null, p_published_to timestamptz default null
)
returns table (id uuid, category text, title text, institution jsonb, cover jsonb, is_pinned boolean,
  published_at timestamptz, status text, created_at timestamptz, updated_at timestamptz, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception using errcode = '22023', message = 'invalid pagination'; end if;
  if p_category is not null and p_category not in ('notice', 'association_news', 'promotion_video', 'member_news') then raise exception using errcode = '22023', message = 'invalid post category'; end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then raise exception using errcode = '22023', message = 'invalid content status'; end if;
  if p_published_from is not null and p_published_to is not null and p_published_from > p_published_to then raise exception using errcode = '22023', message = 'invalid published date range'; end if;
  if p_admin and auth.role() <> 'authenticated' then raise exception using errcode = '42501', message = 'admin read requires authentication'; end if;
  return query select p.id, p.category, p.title,
    case when i.id is null then null else jsonb_build_object('id', i.id, 'institution_type', i.institution_type, 'name', i.name, 'logo', case when lf.id is null then null else jsonb_build_object('id', lf.id, 'file_kind', lf.file_kind, 'bucket_name', lf.bucket_name, 'storage_path', lf.storage_path, 'original_name', lf.original_name, 'mime_type', lf.mime_type, 'size_bytes', lf.size_bytes, 'width_px', lf.width_px, 'height_px', lf.height_px, 'alt_text', lf.alt_text, 'created_at', lf.created_at, 'updated_at', lf.updated_at) end) end,
    case when cf.id is null then null else jsonb_build_object('id', cf.id, 'file_kind', cf.file_kind, 'bucket_name', cf.bucket_name, 'storage_path', cf.storage_path, 'original_name', cf.original_name, 'mime_type', cf.mime_type, 'size_bytes', cf.size_bytes, 'width_px', cf.width_px, 'height_px', cf.height_px, 'alt_text', cf.alt_text, 'created_at', cf.created_at, 'updated_at', cf.updated_at) end,
    p.is_pinned, p.published_at, p.status, p.created_at, p.updated_at, count(*) over()
  from public.posts p left join public.institutions i on i.id = p.institution_id left join public.files lf on lf.id = i.logo_file_id
  left join lateral (select f.* from public.post_files pf join public.files f on f.id = pf.file_id where pf.post_id = p.id and pf.role = 'cover' order by pf.sort_order, pf.created_at, pf.file_id limit 1) cf on true
  where p.category is not null and (p_admin or (p.status = 'published' and p.published_at <= now()))
    and (p_category is null or p.category = p_category) and (p_institution_id is null or p.institution_id = p_institution_id)
    and (not p_admin or p_status is null or p.status = p_status) and (p_published_from is null or p.published_at >= p_published_from) and (p_published_to is null or p.published_at <= p_published_to)
    and (nullif(btrim(p_q), '') is null or p.title ilike '%' || btrim(p_q) || '%')
  order by p.is_pinned desc, p.published_at desc nulls last, p.created_at desc, p.id desc limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;
