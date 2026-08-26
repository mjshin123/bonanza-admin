-- Preserve gallery-specific ordering/visibility for source-generated items and
-- expose source metadata so public gallery cards can land on their post.

alter table public.gallery_items
  add column if not exists is_hidden boolean not null default false;

create index gallery_items_visible_order_idx
  on public.gallery_items (gallery_id, sort_order, created_at, file_id)
  where is_hidden = false;

drop policy if exists "public can read published gallery items"
on public.gallery_items;
create policy "public can read published gallery items"
on public.gallery_items for select to anon using (
  is_hidden = false
  and exists (
    select 1
    from public.galleries g
    where g.id = gallery_id
      and g.status = 'published'
      and g.published_at <= now()
  )
);

create or replace function private.sync_source_gallery(
  p_source_type text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_title text;
  source_description text;
  source_event_date date;
  source_status text;
  source_published_at timestamptz;
  source_created_at timestamptz;
  visible_count bigint;
  target_gallery_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if p_source_type not in ('post', 'resource', 'seminar') then
    raise exception using errcode = '22023', message = 'invalid gallery source type';
  end if;

  if p_source_type = 'post' then
    select p.title, '', coalesce(p.published_at, p.created_at)::date,
      p.status, p.published_at, p.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.posts p
    where p.id = p_source_id and p.category is not null;

    select count(*) into visible_count
    from public.post_files pf
    where pf.post_id = p_source_id
      and pf.file_id is not null
      and pf.show_in_gallery = true;
  elsif p_source_type = 'resource' then
    select r.title, '', coalesce(r.published_at, r.created_at)::date,
      r.status, r.published_at, r.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.resources r
    where r.id = p_source_id;

    select count(*) into visible_count
    from public.resource_files rf
    join public.files f on f.id = rf.file_id and f.file_kind = 'image'
    where rf.resource_id = p_source_id
      and rf.show_in_gallery = true;
  else
    select s.title, coalesce(s.introduction, ''), s.starts_at::date,
      s.status, s.published_at, s.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.seminars s
    where s.id = p_source_id;

    select count(*) into visible_count
    from public.seminar_files sf
    where sf.seminar_id = p_source_id
      and sf.show_in_gallery = true;
  end if;

  if source_title is null or visible_count = 0 then
    delete from public.galleries g
    where g.source_type = p_source_type and g.source_id = p_source_id;
    return;
  end if;

  insert into public.galleries (
    title,
    description,
    event_date,
    status,
    published_at,
    display_order,
    source_type,
    source_id,
    created_at
  ) values (
    source_title,
    source_description,
    source_event_date,
    source_status,
    source_published_at,
    0,
    p_source_type,
    p_source_id,
    source_created_at
  )
  on conflict (source_type, source_id) where source_type is not null
  do update set
    title = excluded.title,
    description = excluded.description,
    event_date = excluded.event_date,
    status = excluded.status,
    published_at = excluded.published_at
  returning id into target_gallery_id;

  if p_source_type = 'post' then
    delete from public.gallery_items gi
    where gi.gallery_id = target_gallery_id
      and not exists (
        select 1
        from public.post_files pf
        where pf.post_id = p_source_id
          and pf.file_id = gi.file_id
          and pf.show_in_gallery = true
      );

    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, pf.file_id,
      left(coalesce(nullif(f.alt_text, ''), source_title), 500),
      pf.sort_order, pf.created_at
    from public.post_files pf
    join public.files f on f.id = pf.file_id
    where pf.post_id = p_source_id
      and pf.file_id is not null
      and pf.show_in_gallery = true
    order by pf.sort_order, pf.created_at, pf.file_id
    on conflict (gallery_id, file_id) do update
      set caption = excluded.caption;
  elsif p_source_type = 'resource' then
    delete from public.gallery_items gi
    where gi.gallery_id = target_gallery_id
      and not exists (
        select 1
        from public.resource_files rf
        join public.files f
          on f.id = rf.file_id and f.file_kind = 'image'
        where rf.resource_id = p_source_id
          and rf.file_id = gi.file_id
          and rf.show_in_gallery = true
      );

    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, rf.file_id,
      left(coalesce(nullif(f.alt_text, ''), source_title), 500),
      rf.sort_order, rf.created_at
    from public.resource_files rf
    join public.files f on f.id = rf.file_id and f.file_kind = 'image'
    where rf.resource_id = p_source_id
      and rf.show_in_gallery = true
    order by rf.sort_order, rf.created_at, rf.file_id
    on conflict (gallery_id, file_id) do update
      set caption = excluded.caption;
  else
    delete from public.gallery_items gi
    where gi.gallery_id = target_gallery_id
      and not exists (
        select 1
        from public.seminar_files sf
        where sf.seminar_id = p_source_id
          and sf.file_id = gi.file_id
          and sf.show_in_gallery = true
      );

    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, sf.file_id,
      left(
        coalesce(
          nullif(f.alt_text, ''),
          nullif(source_description, ''),
          source_title
        ),
        500
      ),
      sf.sort_order, sf.created_at
    from public.seminar_files sf
    join public.files f on f.id = sf.file_id
    where sf.seminar_id = p_source_id
      and sf.show_in_gallery = true
    order by sf.sort_order, sf.created_at, sf.file_id
    on conflict (gallery_id, file_id) do update
      set caption = excluded.caption;
  end if;
end;
$$;

revoke all on function private.sync_source_gallery(text, uuid)
from public, anon;
grant execute on function private.sync_source_gallery(text, uuid)
to authenticated;

create or replace function public.set_gallery_item_hidden(
  p_gallery_id uuid,
  p_file_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  update public.gallery_items
  set is_hidden = p_hidden
  where gallery_id = p_gallery_id and file_id = p_file_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'gallery item not found';
  end if;
end;
$$;

create or replace function public.remove_gallery_item_from_source(
  p_gallery_id uuid,
  p_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_source_type text;
  item_source_id uuid;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select source_type, source_id
  into item_source_type, item_source_id
  from public.galleries
  where id = p_gallery_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'gallery not found';
  end if;

  if item_source_type = 'post' then
    update public.post_files
    set show_in_gallery = false
    where post_id = item_source_id and file_id = p_file_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'source gallery item not found';
    end if;
    perform private.sync_source_gallery(item_source_type, item_source_id);
  elsif item_source_type = 'resource' then
    update public.resource_files
    set show_in_gallery = false
    where resource_id = item_source_id and file_id = p_file_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'source gallery item not found';
    end if;
    perform private.sync_source_gallery(item_source_type, item_source_id);
  elsif item_source_type = 'seminar' then
    update public.seminar_files
    set show_in_gallery = false
    where seminar_id = item_source_id and file_id = p_file_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'source gallery item not found';
    end if;
    perform private.sync_source_gallery(item_source_type, item_source_id);
  else
    delete from public.gallery_items
    where gallery_id = p_gallery_id and file_id = p_file_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'gallery item not found';
    end if;
  end if;
end;
$$;

revoke all on function public.set_gallery_item_hidden(uuid, uuid, boolean)
from public, anon;
grant execute on function public.set_gallery_item_hidden(uuid, uuid, boolean)
to authenticated;

revoke all on function public.remove_gallery_item_from_source(uuid, uuid)
from public, anon;
grant execute on function public.remove_gallery_item_from_source(uuid, uuid)
to authenticated;

drop function public.list_galleries(
  integer,
  integer,
  text,
  date,
  date,
  text,
  boolean
);

create function public.list_galleries(
  p_page integer default 1,
  p_page_size integer default 10,
  p_q text default null,
  p_from date default null,
  p_to date default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid,
  title text,
  description text,
  event_date date,
  cover_image jsonb,
  item_count bigint,
  display_order integer,
  published_at timestamptz,
  status text,
  source_type text,
  source_id uuid,
  source_category text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
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
  select
    g.id,
    g.title,
    g.description,
    g.event_date,
    case when cover_file.id is null then null else jsonb_build_object(
      'id', cover_file.id,
      'file_kind', cover_file.file_kind,
      'bucket_name', cover_file.bucket_name,
      'storage_path', cover_file.storage_path,
      'original_name', cover_file.original_name,
      'mime_type', cover_file.mime_type,
      'size_bytes', cover_file.size_bytes,
      'width_px', cover_file.width_px,
      'height_px', cover_file.height_px,
      'alt_text', cover_file.alt_text,
      'created_at', cover_file.created_at,
      'updated_at', cover_file.updated_at
    ) end,
    (
      select count(*)
      from public.gallery_items counted_item
      where counted_item.gallery_id = g.id
        and (p_admin or counted_item.is_hidden = false)
    ),
    g.display_order,
    g.published_at,
    g.status,
    g.source_type,
    g.source_id,
    case when g.source_type = 'post' then (
      select p.category
      from public.posts p
      where p.id = g.source_id
    ) else null end,
    g.created_at,
    g.updated_at,
    count(*) over()
  from public.galleries g
  left join lateral (
    select f.*
    from public.gallery_items gallery_item
    join public.content_public_files f on f.id = gallery_item.file_id
    where gallery_item.gallery_id = g.id
      and (p_admin or gallery_item.is_hidden = false)
    order by gallery_item.sort_order, gallery_item.created_at, gallery_item.file_id
    limit 1
  ) cover_file on true
  where (p_admin or (g.status = 'published' and g.published_at <= now()))
    and (p_admin or exists (
      select 1
      from public.gallery_items visible_item
      where visible_item.gallery_id = g.id
        and visible_item.is_hidden = false
    ))
    and (not p_admin or p_status is null or g.status = p_status)
    and (p_from is null or g.event_date >= p_from)
    and (p_to is null or g.event_date <= p_to)
    and (
      nullif(btrim(p_q), '') is null
      or g.title ilike '%' || btrim(p_q) || '%'
      or g.description ilike '%' || btrim(p_q) || '%'
    )
  order by
    g.event_date desc nulls last,
    g.display_order,
    g.published_at desc nulls last,
    g.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

grant select (source_type, source_id)
on public.galleries to anon;
grant select on public.gallery_items to anon;

revoke all on function public.list_galleries(
  integer,
  integer,
  text,
  date,
  date,
  text,
  boolean
) from public;
grant execute on function public.list_galleries(
  integer,
  integer,
  text,
  date,
  date,
  text,
  boolean
) to anon, authenticated;
