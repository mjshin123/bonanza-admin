-- Content v2 command APIs and durable file-deletion compensation.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.file_delete_operations (
  operation_id uuid primary key default gen_random_uuid(),
  file_id uuid not null unique,
  file_kind text not null,
  bucket_name text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width_px integer,
  height_px integer,
  alt_text text,
  uploaded_by uuid,
  file_created_at timestamptz not null,
  file_updated_at timestamptz not null,
  requested_by uuid not null,
  created_at timestamptz not null default now()
);

revoke all on private.file_delete_operations from public, anon, authenticated;

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
      p_input ->> 'category',
      p_input ->> 'title',
      coalesce(p_input ->> 'summary', ''),
      coalesce(p_input ->> 'content', ''),
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
      category = p_input ->> 'category',
      title = p_input ->> 'title',
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
  insert into public.post_files (post_id, file_id, role, sort_order)
  select saved.id, (item ->> 'fileId')::uuid, item ->> 'role', ordinality - 1
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

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
    where jsonb_typeof(item) <> 'object' or nullif(item ->> 'fileId', '') is null
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
  insert into public.resource_files (resource_id, file_id, sort_order)
  select saved.id, (item ->> 'fileId')::uuid, ordinality - 1
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

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
  insert into public.seminar_files (seminar_id, file_id, role, sort_order)
  select saved.id, (item ->> 'fileId')::uuid, item ->> 'role', ordinality - 1
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  select s.* into saved from public.seminars s where s.id = saved.id;
  return saved;
end;
$$;

create or replace function public.save_gallery(
  p_input jsonb,
  p_files jsonb default '[]'::jsonb,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.galleries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.galleries;
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
    where jsonb_typeof(item) <> 'object' or nullif(item ->> 'fileId', '') is null
      or char_length(coalesce(item ->> 'caption', '')) > 500
  ) then
    raise exception using errcode = '22023', message = 'invalid gallery item';
  end if;
  if (select count(*) from jsonb_array_elements(p_files)) <>
    (select count(distinct item ->> 'fileId') from jsonb_array_elements(p_files) item) then
    raise exception using errcode = '23505', message = 'duplicate gallery file';
  end if;

  if p_id is null then
    insert into public.galleries (
      title, description, event_date, status, published_at, display_order
    ) values (
      p_input ->> 'title', coalesce(p_input ->> 'description', ''),
      nullif(p_input ->> 'eventDate', '')::date,
      coalesce(p_input ->> 'status', 'draft'),
      nullif(p_input ->> 'publishedAt', '')::timestamptz,
      coalesce((p_input ->> 'displayOrder')::integer, 0)
    ) returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'expectedUpdatedAt is required';
    end if;
    update public.galleries g set
      title = p_input ->> 'title',
      description = coalesce(p_input ->> 'description', ''),
      event_date = nullif(p_input ->> 'eventDate', '')::date,
      status = coalesce(p_input ->> 'status', 'draft'),
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz,
      display_order = coalesce((p_input ->> 'displayOrder')::integer, 0)
    where g.id = p_id and g.updated_at = p_expected_updated_at
    returning g.* into saved;
    if not found then
      if exists (select 1 from public.galleries g where g.id = p_id) then
        raise exception using errcode = '40001', message = 'gallery was modified by another request';
      end if;
      raise exception using errcode = 'P0002', message = 'gallery not found';
    end if;
  end if;

  delete from public.gallery_items gi where gi.gallery_id = saved.id;
  insert into public.gallery_items (gallery_id, file_id, caption, sort_order)
  select saved.id, (item ->> 'fileId')::uuid,
    coalesce(item ->> 'caption', ''), ordinality - 1
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  select g.* into saved from public.galleries g where g.id = saved.id;
  return saved;
end;
$$;

create or replace function public.begin_file_delete(p_file_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot public.files;
  operation uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select f.* into snapshot from public.files f where f.id = p_file_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'file not found';
  end if;
  if exists (select 1 from public.institutions i where i.logo_file_id = p_file_id)
    or exists (select 1 from public.post_files pf where pf.file_id = p_file_id)
    or exists (select 1 from public.resource_files rf where rf.file_id = p_file_id)
    or exists (select 1 from public.seminar_files sf where sf.file_id = p_file_id)
    or exists (select 1 from public.gallery_items gi where gi.file_id = p_file_id)
  then
    raise exception using errcode = '23503', message = 'file is in use';
  end if;

  insert into private.file_delete_operations (
    file_id, file_kind, bucket_name, storage_path, original_name, mime_type,
    size_bytes, width_px, height_px, alt_text, uploaded_by,
    file_created_at, file_updated_at, requested_by
  ) values (
    snapshot.id, snapshot.file_kind, snapshot.bucket_name, snapshot.storage_path,
    snapshot.original_name, snapshot.mime_type, snapshot.size_bytes,
    snapshot.width_px, snapshot.height_px, snapshot.alt_text,
    snapshot.uploaded_by, snapshot.created_at, snapshot.updated_at, auth.uid()
  ) returning operation_id into operation;

  delete from public.files f where f.id = p_file_id;
  return jsonb_build_object(
    'operationId', operation,
    'fileId', snapshot.id,
    'bucketName', snapshot.bucket_name,
    'storagePath', snapshot.storage_path
  );
end;
$$;

create or replace function public.complete_file_delete(p_operation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_file_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  delete from private.file_delete_operations operation
  where operation.operation_id = p_operation_id
    and operation.requested_by = auth.uid()
  returning operation.file_id into deleted_file_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'file delete operation not found';
  end if;
  return deleted_file_id;
end;
$$;

create or replace function public.restore_file_delete(p_operation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.file_delete_operations;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select o.* into operation
  from private.file_delete_operations o
  where o.operation_id = p_operation_id and o.requested_by = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'file delete operation not found';
  end if;
  if exists (select 1 from public.files f where f.id = operation.file_id) then
    raise exception using errcode = '23505', message = 'file already exists';
  end if;

  insert into public.files (
    id, file_kind, bucket_name, storage_path, original_name, mime_type,
    size_bytes, width_px, height_px, alt_text, uploaded_by, created_at, updated_at
  ) values (
    operation.file_id, operation.file_kind, operation.bucket_name,
    operation.storage_path, operation.original_name, operation.mime_type,
    operation.size_bytes, operation.width_px, operation.height_px,
    operation.alt_text, operation.uploaded_by,
    operation.file_created_at, operation.file_updated_at
  );
  delete from private.file_delete_operations o
  where o.operation_id = p_operation_id;
  return operation.file_id;
end;
$$;

revoke all on function public.save_content_post(jsonb, jsonb, uuid, timestamptz) from public, anon;
revoke all on function public.save_resource(jsonb, jsonb, uuid, timestamptz) from public, anon;
revoke all on function public.save_seminar(jsonb, jsonb, uuid, timestamptz) from public, anon;
revoke all on function public.save_gallery(jsonb, jsonb, uuid, timestamptz) from public, anon;
revoke all on function public.begin_file_delete(uuid) from public, anon;
revoke all on function public.complete_file_delete(uuid) from public, anon;
revoke all on function public.restore_file_delete(uuid) from public, anon;

grant execute on function public.save_content_post(jsonb, jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.save_resource(jsonb, jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.save_seminar(jsonb, jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.save_gallery(jsonb, jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.begin_file_delete(uuid) to authenticated;
grant execute on function public.complete_file_delete(uuid) to authenticated;
grant execute on function public.restore_file_delete(uuid) to authenticated;
