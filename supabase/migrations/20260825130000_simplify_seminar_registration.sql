-- Simplify seminar registration: drop selection_method / selection_method_detail /
-- capacity / registration_deadline, make location optional, unify seminar_files
-- poster/photo roles into a single ordered image list, and add a manually-set
-- is_featured flag independent of the existing computed upcoming/past timing.

-- ---------------------------------------------------------------------------
-- reorder_content_files: seminar_files branch no longer groups by role
-- ---------------------------------------------------------------------------

create or replace function public.reorder_content_files(
  p_relation text,
  p_parent_id uuid,
  p_file_ids uuid[]
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  expected_count integer;
  related_count integer;
begin
  if p_file_ids is null then
    raise exception 'file list is required';
  end if;
  if cardinality(p_file_ids) = 0 then
    return;
  end if;

  if p_relation = 'post_files' then
    select count(*) into expected_count from public.post_files
      where post_id = p_parent_id and file_id = any(p_file_ids);
    select count(*) into related_count from public.post_files
      where post_id = p_parent_id and file_id is not null;
    if expected_count <> cardinality(p_file_ids) or related_count <> cardinality(p_file_ids) then
      raise exception 'invalid post file list';
    end if;
    update public.post_files pf set sort_order = v.ordinality - 1
      from unnest(p_file_ids) with ordinality v(file_id, ordinality)
      where pf.post_id = p_parent_id and pf.file_id = v.file_id;
  elsif p_relation = 'resource_files' then
    select count(*) into expected_count from public.resource_files
      where resource_id = p_parent_id and file_id = any(p_file_ids);
    select count(*) into related_count from public.resource_files
      where resource_id = p_parent_id;
    if expected_count <> cardinality(p_file_ids) or related_count <> cardinality(p_file_ids) then
      raise exception 'invalid resource file list';
    end if;
    update public.resource_files rf set sort_order = v.ordinality - 1
      from unnest(p_file_ids) with ordinality v(file_id, ordinality)
      where rf.resource_id = p_parent_id and rf.file_id = v.file_id;
  elsif p_relation = 'seminar_files' then
    select count(*) into expected_count from public.seminar_files
      where seminar_id = p_parent_id and file_id = any(p_file_ids);
    select count(*) into related_count from public.seminar_files
      where seminar_id = p_parent_id;
    if expected_count <> cardinality(p_file_ids) or related_count <> cardinality(p_file_ids) then
      raise exception 'invalid seminar file list';
    end if;
    update public.seminar_files sf set sort_order = v.ordinality - 1
      from unnest(p_file_ids) with ordinality v(file_id, ordinality)
      where sf.seminar_id = p_parent_id and sf.file_id = v.file_id;
  elsif p_relation = 'gallery_items' then
    select count(*) into expected_count from public.gallery_items
      where gallery_id = p_parent_id and file_id = any(p_file_ids);
    select count(*) into related_count from public.gallery_items
      where gallery_id = p_parent_id;
    if expected_count <> cardinality(p_file_ids) or related_count <> cardinality(p_file_ids) then
      raise exception 'invalid gallery item list';
    end if;
    update public.gallery_items gi set sort_order = v.ordinality - 1
      from unnest(p_file_ids) with ordinality v(file_id, ordinality)
      where gi.gallery_id = p_parent_id and gi.file_id = v.file_id;
  else
    raise exception 'unsupported relation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_source_gallery: seminar branch no longer filters on role = 'photo'
-- ---------------------------------------------------------------------------

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
    select p.title, p.summary, coalesce(p.published_at, p.created_at)::date,
      p.status, p.published_at, p.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.posts p
    where p.id = p_source_id and p.category is not null;

    select count(*) into visible_count
    from public.post_files pf
    where pf.post_id = p_source_id and pf.file_id is not null and pf.show_in_gallery = true;
  elsif p_source_type = 'resource' then
    select r.title, r.summary, coalesce(r.published_at, r.created_at)::date,
      r.status, r.published_at, r.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.resources r
    where r.id = p_source_id;

    select count(*) into visible_count
    from public.resource_files rf
    join public.files f on f.id = rf.file_id and f.file_kind = 'image'
    where rf.resource_id = p_source_id and rf.show_in_gallery = true;
  else
    select s.title,
      coalesce(nullif(s.result_summary, ''), nullif(s.introduction, ''), ''),
      s.starts_at::date, s.status, s.published_at, s.created_at
    into source_title, source_description, source_event_date,
      source_status, source_published_at, source_created_at
    from public.seminars s
    where s.id = p_source_id;

    select count(*) into visible_count
    from public.seminar_files sf
    where sf.seminar_id = p_source_id and sf.show_in_gallery = true;
  end if;

  if source_title is null or visible_count = 0 then
    delete from public.galleries g
    where g.source_type = p_source_type and g.source_id = p_source_id;
    return;
  end if;

  insert into public.galleries (
    title, description, event_date, status, published_at, display_order,
    source_type, source_id, created_at
  ) values (
    source_title, source_description, source_event_date, source_status,
    source_published_at, 0, p_source_type, p_source_id, source_created_at
  )
  on conflict (source_type, source_id) where source_type is not null
  do update set
    title = excluded.title, description = excluded.description,
    event_date = excluded.event_date, status = excluded.status,
    published_at = excluded.published_at
  returning id into target_gallery_id;

  delete from public.gallery_items gi where gi.gallery_id = target_gallery_id;

  if p_source_type = 'post' then
    insert into public.gallery_items (gallery_id, file_id, caption, sort_order, created_at)
    select target_gallery_id, pf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      pf.sort_order, pf.created_at
    from public.post_files pf join public.files f on f.id = pf.file_id
    where pf.post_id = p_source_id and pf.file_id is not null and pf.show_in_gallery = true
    order by pf.sort_order, pf.created_at, pf.file_id;
  elsif p_source_type = 'resource' then
    insert into public.gallery_items (gallery_id, file_id, caption, sort_order, created_at)
    select target_gallery_id, rf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      rf.sort_order, rf.created_at
    from public.resource_files rf join public.files f on f.id = rf.file_id and f.file_kind = 'image'
    where rf.resource_id = p_source_id and rf.show_in_gallery = true
    order by rf.sort_order, rf.created_at, rf.file_id;
  else
    insert into public.gallery_items (gallery_id, file_id, caption, sort_order, created_at)
    select target_gallery_id, sf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      sf.sort_order, sf.created_at
    from public.seminar_files sf join public.files f on f.id = sf.file_id
    where sf.seminar_id = p_source_id and sf.show_in_gallery = true
    order by sf.sort_order, sf.created_at, sf.file_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_seminar: drop selection/capacity/deadline + role, add isFeatured
-- ---------------------------------------------------------------------------

create or replace function public.save_seminar(
  p_input jsonb,
  p_files jsonb default '[]'::jsonb,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.seminars
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.seminars;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception using errcode = '22023', message = 'input must be an object';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 1000 then
    raise exception using errcode = '22023', message = 'files must be an array of at most 1000 items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'fileId', '') is null
      or (item ? 'showInGallery' and jsonb_typeof(item -> 'showInGallery') <> 'boolean')
  ) then
    raise exception using errcode = '22023', message = 'invalid seminar file item';
  end if;
  if (select count(*) from jsonb_array_elements(p_files)) <>
    (select count(distinct item ->> 'fileId') from jsonb_array_elements(p_files) item) then
    raise exception using errcode = '23505', message = 'duplicate seminar file';
  end if;

  if p_id is null then
    insert into public.seminars (
      title, introduction, result_summary, content, starts_at, ends_at,
      location, application_url, status, published_at, is_featured
    ) values (
      p_input ->> 'title', coalesce(p_input ->> 'introduction', ''),
      coalesce(p_input ->> 'resultSummary', ''), p_input ->> 'content',
      (p_input ->> 'startsAt')::timestamptz,
      nullif(p_input ->> 'endsAt', '')::timestamptz,
      p_input ->> 'location',
      p_input ->> 'applicationUrl', coalesce(p_input ->> 'status', 'draft'),
      nullif(p_input ->> 'publishedAt', '')::timestamptz,
      coalesce((p_input ->> 'isFeatured')::boolean, false)
    ) returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'expectedUpdatedAt is required';
    end if;
    update public.seminars s set
      title = p_input ->> 'title',
      introduction = coalesce(p_input ->> 'introduction', ''),
      result_summary = coalesce(p_input ->> 'resultSummary', ''),
      content = p_input ->> 'content',
      starts_at = (p_input ->> 'startsAt')::timestamptz,
      ends_at = nullif(p_input ->> 'endsAt', '')::timestamptz,
      location = p_input ->> 'location',
      application_url = p_input ->> 'applicationUrl',
      status = coalesce(p_input ->> 'status', 'draft'),
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz,
      is_featured = coalesce((p_input ->> 'isFeatured')::boolean, false)
    where s.id = p_id and s.updated_at = p_expected_updated_at
    returning s.* into saved;
    if not found then
      if exists (select 1 from public.seminars s where s.id = p_id) then
        raise exception using errcode = '40001', message = 'seminar was modified by another request';
      end if;
      raise exception using errcode = 'P0002', message = 'seminar not found';
    end if;
  end if;

  delete from public.seminar_files sf where sf.seminar_id = saved.id;
  insert into public.seminar_files (seminar_id, file_id, sort_order, show_in_gallery)
  select saved.id, (item ->> 'fileId')::uuid, ordinality - 1,
    coalesce((item ->> 'showInGallery')::boolean, false)
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  perform private.sync_source_gallery('seminar', saved.id);
  select s.* into saved from public.seminars s where s.id = saved.id;
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_seminars: output columns change (add is_featured), so DROP + CREATE
-- (CREATE OR REPLACE cannot alter a RETURNS TABLE column set -- confirmed by
-- this repo's own list_resources migration, 20260825120000).
-- ---------------------------------------------------------------------------

drop function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz);

create function public.list_seminars(
  p_page integer default 1,
  p_page_size integer default 10,
  p_q text default null,
  p_timing text default 'all',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_status text default null,
  p_admin boolean default false,
  p_published_from timestamptz default null,
  p_published_to timestamptz default null
)
returns table (
  id uuid,
  title text,
  introduction text,
  result_summary text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  poster jsonb,
  published_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint,
  is_featured boolean
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
  if p_timing not in ('all', 'upcoming', 'past') then
    raise exception using errcode = '22023', message = 'invalid seminar timing';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception using errcode = '22023', message = 'invalid date range';
  end if;
  if p_published_from is not null and p_published_to is not null and p_published_from > p_published_to then
    raise exception using errcode = '22023', message = 'invalid published date range';
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
    s.published_at, s.status, s.created_at, s.updated_at, count(*) over(),
    s.is_featured
  from public.seminars s
  left join lateral (
    select f.*
    from public.seminar_files sf
    join public.files f on f.id = sf.file_id
    where sf.seminar_id = s.id
    order by sf.sort_order, sf.created_at, sf.file_id
    limit 1
  ) pf on true
  where (p_admin or (s.status = 'published' and s.published_at <= now()))
    and (not p_admin or p_status is null or s.status = p_status)
    and (p_from is null or s.starts_at >= p_from)
    and (p_to is null or s.starts_at <= p_to)
    and (p_published_from is null or s.published_at >= p_published_from)
    and (p_published_to is null or s.published_at <= p_published_to)
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
  limit p_page_size
  offset ((p_page - 1) * p_page_size);
end;
$$;

revoke all on function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz) from public;
grant execute on function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- seminars: drop selection/capacity/deadline columns, make location optional,
-- add is_featured. Dropping a column auto-drops any same-table CHECK
-- constraint or index that references it (no explicit DROP CONSTRAINT/INDEX
-- needed) -- this repo's own remove_resource_reference_year.sql relies on
-- the same behavior. Dropping NOT NULL on location needs no CHECK rewrite:
-- `check (char_length(btrim(location)) between 1 and 300)` already evaluates
-- to NULL (which CHECK treats as satisfied, not violated) when location is
-- NULL, so it continues to enforce the 1-300 length rule only when non-null.
-- ---------------------------------------------------------------------------

alter table public.seminars
  alter column location drop not null,
  add column is_featured boolean not null default false,
  drop column selection_method,
  drop column selection_method_detail,
  drop column capacity,
  drop column registration_deadline;

-- ---------------------------------------------------------------------------
-- seminar_files: drop role. Auto-drops seminar_files_gallery_photo_only_check,
-- seminar_files_one_poster_uidx, and seminar_files_seminar_order_idx (all
-- reference role); recreate the order index without role.
-- ---------------------------------------------------------------------------

alter table public.seminar_files drop column role;

create index seminar_files_seminar_order_idx
  on public.seminar_files (seminar_id, sort_order, created_at, file_id);

-- is_featured must be explicitly granted for anon (column-level grants,
-- same pattern as institutions.is_upcoming in 20260825090000).
grant select (is_featured) on public.seminars to anon;
