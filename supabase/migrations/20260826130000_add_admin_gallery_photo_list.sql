-- List published gallery photos as independently manageable admin tiles.
-- Keep list_galleries unchanged for backward compatibility with the public site.

create or replace function public.list_admin_gallery_photos(
  p_page integer default 1,
  p_page_size integer default 24,
  p_q text default null
)
returns table (
  gallery_id uuid,
  file_id uuid,
  photo jsonb,
  title text,
  event_date date,
  source_type text,
  source_id uuid,
  source_category text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;

  return query
  select
    g.id,
    gi.file_id,
    jsonb_build_object(
      'id', f.id,
      'file_kind', f.file_kind,
      'bucket_name', f.bucket_name,
      'storage_path', f.storage_path,
      'original_name', f.original_name,
      'mime_type', f.mime_type,
      'size_bytes', f.size_bytes,
      'width_px', f.width_px,
      'height_px', f.height_px,
      'alt_text', f.alt_text,
      'created_at', f.created_at,
      'updated_at', f.updated_at
    ),
    g.title,
    g.event_date,
    g.source_type,
    g.source_id,
    case when g.source_type = 'post' then (
      select p.category
      from public.posts p
      where p.id = g.source_id
    ) else null end,
    count(*) over()
  from public.gallery_items gi
  join public.galleries g on g.id = gi.gallery_id
  join public.content_public_files f on f.id = gi.file_id
  where g.status = 'published'
    and g.published_at <= now()
    and gi.is_hidden = false
    and (
      nullif(btrim(p_q), '') is null
      or g.title ilike '%' || btrim(p_q) || '%'
    )
  order by
    g.event_date desc nulls last,
    g.published_at desc nulls last,
    g.id desc,
    gi.sort_order,
    gi.created_at,
    gi.file_id
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

revoke all on function public.list_admin_gallery_photos(integer, integer, text)
from public, anon;
grant execute on function public.list_admin_gallery_photos(integer, integer, text)
to authenticated;
