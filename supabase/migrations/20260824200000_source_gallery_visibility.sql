-- Source-owned photo gallery visibility.
-- Posts, resources, and seminars remain the source of truth; galleries are synchronized
-- materialized albums used by the existing public gallery read API.

alter table public.post_files
  add column show_in_gallery boolean not null default false;

alter table public.resource_files
  add column show_in_gallery boolean not null default false;

alter table public.seminar_files
  add column show_in_gallery boolean not null default false;

alter table public.seminar_files
  add constraint seminar_files_gallery_photo_only_check
  check (not show_in_gallery or role = 'photo');

alter table public.galleries
  add column source_type text,
  add column source_id uuid,
  add constraint galleries_source_pair_check check (
    (source_type is null and source_id is null)
    or (source_type in ('post', 'resource', 'seminar') and source_id is not null)
  );

create unique index galleries_source_uidx
  on public.galleries (source_type, source_id)
  where source_type is not null;

create index post_files_gallery_visible_idx
  on public.post_files (post_id, sort_order, file_id)
  where show_in_gallery = true and file_id is not null;

create index seminar_files_gallery_visible_idx
  on public.seminar_files (seminar_id, sort_order, file_id)
  where show_in_gallery = true;

create index resource_files_gallery_visible_idx
  on public.resource_files (resource_id, sort_order, file_id)
  where show_in_gallery = true;

create or replace function public.validate_gallery_image_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.show_in_gallery and not exists (
    select 1 from public.files f
    where f.id = new.file_id and f.file_kind = 'image'
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'gallery_visibility_requires_image',
      message = 'only image files can be shown in gallery';
  end if;
  return new;
end;
$$;

create trigger resource_files_validate_gallery_image
before insert or update of file_id, show_in_gallery
on public.resource_files for each row
execute function public.validate_gallery_image_flag();

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
    where pf.post_id = p_source_id
      and pf.file_id is not null
      and pf.show_in_gallery = true;
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
    where sf.seminar_id = p_source_id
      and sf.role = 'photo'
      and sf.show_in_gallery = true;
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
    title = excluded.title,
    description = excluded.description,
    event_date = excluded.event_date,
    status = excluded.status,
    published_at = excluded.published_at
  returning id into target_gallery_id;

  delete from public.gallery_items gi where gi.gallery_id = target_gallery_id;

  if p_source_type = 'post' then
    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, pf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      pf.sort_order, pf.created_at
    from public.post_files pf
    join public.files f on f.id = pf.file_id
    where pf.post_id = p_source_id
      and pf.file_id is not null
      and pf.show_in_gallery = true
    order by pf.sort_order, pf.created_at, pf.file_id;
  elsif p_source_type = 'resource' then
    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, rf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      rf.sort_order, rf.created_at
    from public.resource_files rf
    join public.files f on f.id = rf.file_id and f.file_kind = 'image'
    where rf.resource_id = p_source_id and rf.show_in_gallery = true
    order by rf.sort_order, rf.created_at, rf.file_id;
  else
    insert into public.gallery_items (
      gallery_id, file_id, caption, sort_order, created_at
    )
    select target_gallery_id, sf.file_id,
      left(coalesce(nullif(f.alt_text, ''), nullif(source_description, ''), source_title), 500),
      sf.sort_order, sf.created_at
    from public.seminar_files sf
    join public.files f on f.id = sf.file_id
    where sf.seminar_id = p_source_id
      and sf.role = 'photo'
      and sf.show_in_gallery = true
    order by sf.sort_order, sf.created_at, sf.file_id;
  end if;
end;
$$;

revoke all on function private.sync_source_gallery(text, uuid)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.sync_source_gallery(text, uuid)
  to authenticated;

create or replace function private.delete_source_gallery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.galleries g
  where g.source_type = tg_argv[0] and g.source_id = old.id;
  return old;
end;
$$;

create trigger posts_delete_source_gallery
after delete on public.posts for each row
execute function private.delete_source_gallery('post');

create trigger resources_delete_source_gallery
after delete on public.resources for each row
execute function private.delete_source_gallery('resource');

create trigger seminars_delete_source_gallery
after delete on public.seminars for each row
execute function private.delete_source_gallery('seminar');

create or replace function public.save_content_post(
  p_input jsonb,
  p_files jsonb default '[]'::jsonb,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.posts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.posts;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception using errcode = '22023', message = 'input must be an object';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) > 1000 then
    raise exception using errcode = '22023', message = 'files must be an array of at most 1000 items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'fileId', '') is null
      or item ->> 'role' not in ('cover', 'content')
      or (item ? 'showInGallery' and jsonb_typeof(item -> 'showInGallery') <> 'boolean')
  ) then
    raise exception using errcode = '22023', message = 'invalid post file item';
  end if;
  if (select count(*) from jsonb_array_elements(p_files)) <>
    (select count(distinct item ->> 'fileId') from jsonb_array_elements(p_files) item) then
    raise exception using errcode = '23505', message = 'duplicate post file';
  end if;

  if p_id is null then
    insert into public.posts (
      category, title, summary, content, institution_id, status,
      is_pinned, published_at
    ) values (
      p_input ->> 'category', p_input ->> 'title',
      coalesce(p_input ->> 'summary', ''), coalesce(p_input ->> 'content', ''),
      nullif(p_input ->> 'institutionId', '')::uuid,
      coalesce(p_input ->> 'status', 'draft'),
      coalesce((p_input ->> 'isPinned')::boolean, false),
      nullif(p_input ->> 'publishedAt', '')::timestamptz
    ) returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'expectedUpdatedAt is required';
    end if;
    update public.posts p set
      category = p_input ->> 'category', title = p_input ->> 'title',
      summary = coalesce(p_input ->> 'summary', ''),
      content = coalesce(p_input ->> 'content', ''),
      institution_id = nullif(p_input ->> 'institutionId', '')::uuid,
      status = coalesce(p_input ->> 'status', 'draft'),
      is_pinned = coalesce((p_input ->> 'isPinned')::boolean, false),
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz
    where p.id = p_id and p.updated_at = p_expected_updated_at
    returning p.* into saved;
    if not found then
      if exists (select 1 from public.posts p where p.id = p_id) then
        raise exception using errcode = '40001', message = 'post was modified by another request';
      end if;
      raise exception using errcode = 'P0002', message = 'post not found';
    end if;
  end if;

  delete from public.post_files pf where pf.post_id = saved.id;
  insert into public.post_files (
    post_id, file_id, role, sort_order, show_in_gallery
  )
  select saved.id, (item ->> 'fileId')::uuid, item ->> 'role',
    ordinality - 1, coalesce((item ->> 'showInGallery')::boolean, false)
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  perform private.sync_source_gallery('post', saved.id);
  select p.* into saved from public.posts p where p.id = saved.id;
  return saved;
end;
$$;

create or replace function public.save_resource(
  p_input jsonb,
  p_files jsonb default '[]'::jsonb,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.resources
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.resources;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception using errcode = '22023', message = 'input must be an object';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) > 1000 then
    raise exception using errcode = '22023', message = 'files must be an array of at most 1000 items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'fileId', '') is null
      or (item ? 'showInGallery' and jsonb_typeof(item -> 'showInGallery') <> 'boolean')
  ) then
    raise exception using errcode = '22023', message = 'invalid resource file item';
  end if;
  if (select count(*) from jsonb_array_elements(p_files)) <>
    (select count(distinct item ->> 'fileId') from jsonb_array_elements(p_files) item) then
    raise exception using errcode = '23505', message = 'duplicate resource file';
  end if;

  if p_id is null then
    insert into public.resources (
      category, title, summary, reference_year, status, published_at
    ) values (
      p_input ->> 'category', p_input ->> 'title',
      coalesce(p_input ->> 'summary', ''),
      nullif(p_input ->> 'referenceYear', '')::smallint,
      coalesce(p_input ->> 'status', 'draft'),
      nullif(p_input ->> 'publishedAt', '')::timestamptz
    ) returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'expectedUpdatedAt is required';
    end if;
    update public.resources r set
      category = p_input ->> 'category',
      title = p_input ->> 'title',
      summary = coalesce(p_input ->> 'summary', ''),
      reference_year = nullif(p_input ->> 'referenceYear', '')::smallint,
      status = coalesce(p_input ->> 'status', 'draft'),
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz
    where r.id = p_id and r.updated_at = p_expected_updated_at
    returning r.* into saved;
    if not found then
      if exists (select 1 from public.resources r where r.id = p_id) then
        raise exception using errcode = '40001', message = 'resource was modified by another request';
      end if;
      raise exception using errcode = 'P0002', message = 'resource not found';
    end if;
  end if;

  delete from public.resource_files rf where rf.resource_id = saved.id;
  insert into public.resource_files (
    resource_id, file_id, sort_order, show_in_gallery
  )
  select saved.id, (item ->> 'fileId')::uuid, ordinality - 1,
    coalesce((item ->> 'showInGallery')::boolean, false)
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  perform private.sync_source_gallery('resource', saved.id);
  select r.* into saved from public.resources r where r.id = saved.id;
  return saved;
end;
$$;

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
  if p_files is null or jsonb_typeof(p_files) <> 'array'
    or jsonb_array_length(p_files) > 1000 then
    raise exception using errcode = '22023', message = 'files must be an array of at most 1000 items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'fileId', '') is null
      or item ->> 'role' not in ('poster', 'photo')
      or (item ? 'showInGallery' and jsonb_typeof(item -> 'showInGallery') <> 'boolean')
      or (coalesce((item ->> 'showInGallery')::boolean, false) and item ->> 'role' <> 'photo')
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
      location, selection_method, selection_method_detail, capacity,
      registration_deadline, application_url, status, published_at
    ) values (
      p_input ->> 'title', coalesce(p_input ->> 'introduction', ''),
      coalesce(p_input ->> 'resultSummary', ''), p_input ->> 'content',
      (p_input ->> 'startsAt')::timestamptz,
      nullif(p_input ->> 'endsAt', '')::timestamptz,
      p_input ->> 'location', p_input ->> 'selectionMethod',
      p_input ->> 'selectionMethodDetail',
      nullif(p_input ->> 'capacity', '')::integer,
      nullif(p_input ->> 'registrationDeadline', '')::timestamptz,
      p_input ->> 'applicationUrl', coalesce(p_input ->> 'status', 'draft'),
      nullif(p_input ->> 'publishedAt', '')::timestamptz
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
      selection_method = p_input ->> 'selectionMethod',
      selection_method_detail = p_input ->> 'selectionMethodDetail',
      capacity = nullif(p_input ->> 'capacity', '')::integer,
      registration_deadline = nullif(p_input ->> 'registrationDeadline', '')::timestamptz,
      application_url = p_input ->> 'applicationUrl',
      status = coalesce(p_input ->> 'status', 'draft'),
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz
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
  insert into public.seminar_files (
    seminar_id, file_id, role, sort_order, show_in_gallery
  )
  select saved.id, (item ->> 'fileId')::uuid, item ->> 'role',
    ordinality - 1, coalesce((item ->> 'showInGallery')::boolean, false)
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  perform private.sync_source_gallery('seminar', saved.id);
  select s.* into saved from public.seminars s where s.id = saved.id;
  return saved;
end;
$$;

grant execute on function public.save_content_post(jsonb, jsonb, uuid, timestamptz)
  to authenticated;
grant execute on function public.save_resource(jsonb, jsonb, uuid, timestamptz)
  to authenticated;
grant execute on function public.save_seminar(jsonb, jsonb, uuid, timestamptz)
  to authenticated;
