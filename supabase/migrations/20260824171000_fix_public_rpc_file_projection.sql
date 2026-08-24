-- Keep public RPCs security-invoker while selecting only anon-readable file columns.
-- Selecting f.* also requested files.uploaded_by, which is intentionally admin-only.

create or replace view public.content_public_files
with (security_invoker = true)
as
select id, file_kind, bucket_name, storage_path, original_name, mime_type,
  size_bytes, width_px, height_px, alt_text, created_at, updated_at
from public.files;

revoke all on public.content_public_files from public;
grant select on public.content_public_files to anon, authenticated;

create or replace function public.list_content_posts(
  p_page integer default 1,
  p_page_size integer default 10,
  p_category text default null,
  p_institution_id uuid default null,
  p_q text default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid, category text, title text, summary text, institution jsonb,
  cover jsonb, is_pinned boolean, published_at timestamptz, status text,
  created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;
  if p_category is not null and p_category not in ('notice', 'association_news', 'member_news') then
    raise exception using errcode = '22023', message = 'invalid post category';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select p.id, p.category, p.title, p.summary,
    case when i.id is null then null else jsonb_build_object(
      'id', i.id, 'institution_type', i.institution_type, 'name', i.name,
      'logo', case when lf.id is null then null else jsonb_build_object(
        'id', lf.id, 'file_kind', lf.file_kind, 'bucket_name', lf.bucket_name,
        'storage_path', lf.storage_path, 'original_name', lf.original_name,
        'mime_type', lf.mime_type, 'size_bytes', lf.size_bytes,
        'width_px', lf.width_px, 'height_px', lf.height_px,
        'alt_text', lf.alt_text, 'created_at', lf.created_at,
        'updated_at', lf.updated_at
      ) end
    ) end,
    case when cf.id is null then null else jsonb_build_object(
      'id', cf.id, 'file_kind', cf.file_kind, 'bucket_name', cf.bucket_name,
      'storage_path', cf.storage_path, 'original_name', cf.original_name,
      'mime_type', cf.mime_type, 'size_bytes', cf.size_bytes,
      'width_px', cf.width_px, 'height_px', cf.height_px,
      'alt_text', cf.alt_text, 'created_at', cf.created_at,
      'updated_at', cf.updated_at
    ) end,
    p.is_pinned, p.published_at, p.status, p.created_at, p.updated_at,
    count(*) over()
  from public.posts p
  left join public.institutions i on i.id = p.institution_id
  left join public.content_public_files lf on lf.id = i.logo_file_id
  left join lateral (
    select f.*
    from public.post_files pf
    join public.content_public_files f on f.id = pf.file_id
    where pf.post_id = p.id and pf.role = 'cover'
    order by pf.sort_order, pf.created_at, pf.file_id
    limit 1
  ) cf on true
  where p.category is not null
    and (p_admin or (p.status = 'published' and p.published_at <= now()))
    and (p_category is null or p.category = p_category)
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (not p_admin or p_status is null or p.status = p_status)
    and (nullif(btrim(p_q), '') is null
      or p.title ilike '%' || btrim(p_q) || '%'
      or p.summary ilike '%' || btrim(p_q) || '%')
  order by p.is_pinned desc, p.published_at desc nulls last,
    p.created_at desc, p.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create or replace function public.list_seminars(
  p_page integer default 1,
  p_page_size integer default 10,
  p_q text default null,
  p_timing text default 'all',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid, title text, introduction text, result_summary text,
  starts_at timestamptz, ends_at timestamptz, location text, poster jsonb,
  published_at timestamptz, status text, created_at timestamptz,
  updated_at timestamptz, total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;
  if p_timing not in ('all', 'upcoming', 'past') then
    raise exception using errcode = '22023', message = 'invalid seminar timing';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception using errcode = '22023', message = 'invalid date range';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select s.id, s.title, s.introduction, s.result_summary, s.starts_at,
    s.ends_at, s.location,
    case when pf.id is null then null else jsonb_build_object(
      'id', pf.id, 'file_kind', pf.file_kind, 'bucket_name', pf.bucket_name,
      'storage_path', pf.storage_path, 'original_name', pf.original_name,
      'mime_type', pf.mime_type, 'size_bytes', pf.size_bytes,
      'width_px', pf.width_px, 'height_px', pf.height_px,
      'alt_text', pf.alt_text, 'created_at', pf.created_at,
      'updated_at', pf.updated_at
    ) end,
    s.published_at, s.status, s.created_at, s.updated_at, count(*) over()
  from public.seminars s
  left join lateral (
    select f.*
    from public.seminar_files sf
    join public.content_public_files f on f.id = sf.file_id
    where sf.seminar_id = s.id and sf.role = 'poster'
    order by sf.sort_order, sf.created_at, sf.file_id
    limit 1
  ) pf on true
  where (p_admin or (s.status = 'published' and s.published_at <= now()))
    and (not p_admin or p_status is null or s.status = p_status)
    and (p_from is null or s.starts_at >= p_from)
    and (p_to is null or s.starts_at <= p_to)
    and (p_timing = 'all'
      or (p_timing = 'upcoming' and coalesce(s.ends_at, s.starts_at) >= now())
      or (p_timing = 'past' and coalesce(s.ends_at, s.starts_at) < now()))
    and (nullif(btrim(p_q), '') is null
      or s.title ilike '%' || btrim(p_q) || '%'
      or s.introduction ilike '%' || btrim(p_q) || '%'
      or s.result_summary ilike '%' || btrim(p_q) || '%'
      or s.location ilike '%' || btrim(p_q) || '%')
  order by
    case when p_timing = 'upcoming' then s.starts_at end asc,
    case when p_timing = 'past' then coalesce(s.ends_at, s.starts_at) end desc,
    case when p_timing = 'past' then s.starts_at end desc,
    case when p_timing = 'all' then s.starts_at end desc,
    case when p_timing = 'upcoming' then s.id end asc,
    s.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create or replace function public.list_galleries(
  p_page integer default 1,
  p_page_size integer default 10,
  p_q text default null,
  p_from date default null,
  p_to date default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid, title text, description text, event_date date, cover_image jsonb,
  item_count bigint, display_order integer, published_at timestamptz,
  status text, created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception using errcode = '22023', message = 'invalid date range';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select g.id, g.title, g.description, g.event_date,
    case when cf.id is null then null else jsonb_build_object(
      'id', cf.id, 'file_kind', cf.file_kind, 'bucket_name', cf.bucket_name,
      'storage_path', cf.storage_path, 'original_name', cf.original_name,
      'mime_type', cf.mime_type, 'size_bytes', cf.size_bytes,
      'width_px', cf.width_px, 'height_px', cf.height_px,
      'alt_text', cf.alt_text, 'created_at', cf.created_at,
      'updated_at', cf.updated_at
    ) end,
    (select count(*) from public.gallery_items gi where gi.gallery_id = g.id),
    g.display_order, g.published_at, g.status, g.created_at, g.updated_at,
    count(*) over()
  from public.galleries g
  left join lateral (
    select f.*
    from public.gallery_items gi
    join public.content_public_files f on f.id = gi.file_id
    where gi.gallery_id = g.id
    order by gi.sort_order, gi.created_at, gi.file_id
    limit 1
  ) cf on true
  where (p_admin or (g.status = 'published' and g.published_at <= now()))
    and (not p_admin or p_status is null or g.status = p_status)
    and (p_from is null or g.event_date >= p_from)
    and (p_to is null or g.event_date <= p_to)
    and (nullif(btrim(p_q), '') is null
      or g.title ilike '%' || btrim(p_q) || '%'
      or g.description ilike '%' || btrim(p_q) || '%')
  order by g.event_date desc nulls last, g.display_order,
    g.published_at desc nulls last, g.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;
