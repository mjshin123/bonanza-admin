-- Photo gallery admin list moves to manual, drag-and-drop ordering.
-- display_order becomes the primary sort key (event_date stays as the
-- tiebreaker for galleries that share the same order, which is the default
-- state for every gallery until an admin drags it into a custom position).

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
    g.display_order,
    g.event_date desc nulls last,
    g.published_at desc nulls last,
    g.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create function public.reorder_galleries(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  matched_count integer;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_ids is null then
    raise exception using errcode = '22023', message = 'id list is required';
  end if;
  if cardinality(p_ids) = 0 then
    return;
  end if;

  expected_count := cardinality(p_ids);
  select count(*) into matched_count
  from public.galleries where id = any(p_ids);
  if matched_count <> expected_count then
    raise exception using errcode = '22023', message = 'invalid gallery id list';
  end if;

  update public.galleries g set display_order = v.ordinality - 1
  from unnest(p_ids) with ordinality v(id, ordinality)
  where g.id = v.id;
end;
$$;

revoke all on function public.reorder_galleries(uuid[]) from public, anon;
grant execute on function public.reorder_galleries(uuid[]) to authenticated;
