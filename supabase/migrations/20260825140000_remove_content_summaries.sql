-- Remove user-facing summary fields while retaining institution descriptions,
-- seminar introductions, gallery descriptions, and gallery item captions.

-- RETURNS TABLE shapes depend on the removed columns, so recreate them below.
drop function public.list_content_posts(integer, integer, text, uuid, text, text, boolean);
drop function public.list_admin_content_posts(integer, integer, text, uuid, text, text, boolean, timestamptz, timestamptz);
drop function public.list_resources(integer, integer, text, text, smallint, text, boolean);
drop function public.list_resources(integer, integer, text, text, text, boolean, timestamptz, timestamptz);
drop function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean);
drop function public.list_admin_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz);

-- The legacy seminar commands exposed the post caption as an argument.
drop function public.create_seminar_event(
  text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, text, boolean, boolean, timestamptz, text[]
);
drop function public.update_seminar_event(
  uuid, text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, text, boolean, boolean, timestamptz, text[]
);

drop trigger posts_sync_v2_legacy_fields on public.posts;
drop function public.sync_post_v2_legacy_fields();

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
    where rf.resource_id = p_source_id and rf.show_in_gallery = true;
  else
    select s.title, coalesce(s.introduction, ''), s.starts_at::date,
      s.status, s.published_at, s.created_at
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
      left(coalesce(nullif(f.alt_text, ''), source_title), 500),
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
      left(coalesce(nullif(f.alt_text, ''), source_title), 500),
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
    where sf.seminar_id = p_source_id and sf.show_in_gallery = true
    order by sf.sort_order, sf.created_at, sf.file_id;
  end if;
end;
$$;

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
      category, title, content, institution_id, status, is_pinned, published_at
    ) values (
      p_input ->> 'category', p_input ->> 'title',
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
  normalized_category text;
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

  normalized_category := case p_input ->> 'category'
    when 'resource' then 'seminar_material'
    when 'financial_disclosure' then 'annual_settlement'
    else p_input ->> 'category'
  end;

  if p_id is null then
    insert into public.resources (
      category, title, reference_year, status, published_at
    ) values (
      normalized_category, p_input ->> 'title',
      nullif(p_input ->> 'referenceYear', '')::smallint,
      coalesce(p_input ->> 'status', 'draft'),
      nullif(p_input ->> 'publishedAt', '')::timestamptz
    ) returning * into saved;
  else
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'expectedUpdatedAt is required';
    end if;
    update public.resources r set
      category = normalized_category,
      title = p_input ->> 'title',
      reference_year = case
        when p_input ? 'referenceYear'
          then nullif(p_input ->> 'referenceYear', '')::smallint
        else r.reference_year
      end,
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
      title, introduction, content, starts_at, ends_at, location,
      selection_method, selection_method_detail, capacity,
      registration_deadline, application_url, status, published_at, is_featured
    ) values (
      p_input ->> 'title', coalesce(p_input ->> 'introduction', ''),
      p_input ->> 'content', (p_input ->> 'startsAt')::timestamptz,
      nullif(p_input ->> 'endsAt', '')::timestamptz,
      coalesce(nullif(p_input ->> 'location', ''), '별도 안내'),
      coalesce(nullif(p_input ->> 'selectionMethod', ''), 'other'),
      case
        when coalesce(nullif(p_input ->> 'selectionMethod', ''), 'other') = 'other'
          then coalesce(nullif(p_input ->> 'selectionMethodDetail', ''), '별도 안내')
        else nullif(p_input ->> 'selectionMethodDetail', '')
      end,
      nullif(p_input ->> 'capacity', '')::integer,
      nullif(p_input ->> 'registrationDeadline', '')::timestamptz,
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
      content = p_input ->> 'content',
      starts_at = (p_input ->> 'startsAt')::timestamptz,
      ends_at = nullif(p_input ->> 'endsAt', '')::timestamptz,
      location = coalesce(nullif(p_input ->> 'location', ''), s.location),
      selection_method = case
        when p_input ? 'selectionMethod'
          then coalesce(nullif(p_input ->> 'selectionMethod', ''), 'other')
        else s.selection_method
      end,
      selection_method_detail = case
        when p_input ? 'selectionMethod' or p_input ? 'selectionMethodDetail'
          then case
            when coalesce(nullif(p_input ->> 'selectionMethod', ''), s.selection_method) = 'other'
              then coalesce(nullif(p_input ->> 'selectionMethodDetail', ''), s.selection_method_detail, '별도 안내')
            else nullif(p_input ->> 'selectionMethodDetail', '')
          end
        else s.selection_method_detail
      end,
      capacity = case
        when p_input ? 'capacity' then nullif(p_input ->> 'capacity', '')::integer
        else s.capacity
      end,
      registration_deadline = case
        when p_input ? 'registrationDeadline'
          then nullif(p_input ->> 'registrationDeadline', '')::timestamptz
        else s.registration_deadline
      end,
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
  insert into public.seminar_files (
    seminar_id, file_id, role, sort_order, show_in_gallery
  )
  select saved.id, (item ->> 'fileId')::uuid,
    coalesce(nullif(item ->> 'role', ''), case when ordinality = 1 then 'poster' else 'photo' end),
    ordinality - 1,
    case
      when coalesce(nullif(item ->> 'role', ''), case when ordinality = 1 then 'poster' else 'photo' end) = 'poster'
        then false
      else coalesce((item ->> 'showInGallery')::boolean, false)
    end
  from jsonb_array_elements(p_files) with ordinality as x(item, ordinality);

  perform private.sync_source_gallery('seminar', saved.id);
  select s.* into saved from public.seminars s where s.id = saved.id;
  return saved;
end;
$$;

alter table public.posts drop column caption;
alter table public.posts drop column summary;
alter table public.resources drop column summary;
alter table public.seminars drop column result_summary;

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
    if board_code in ('notice', 'association_news', 'member_news') then
      new.category := board_code;
      new.institution_id := case when board_code = 'member_news'
        then new.organization_id else null end;
      new.status := case when new.is_published then 'published' else 'draft' end;
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_sync_v2_legacy_fields
before insert or update of category, institution_id, status,
  board_id, organization_id, is_published, published_at
on public.posts for each row execute function public.sync_post_v2_legacy_fields();

-- Remove summaries copied into auto-generated galleries. Independent gallery
-- descriptions and captions (source_type is null) remain untouched.
update public.galleries g
set description = ''
where g.source_type in ('post', 'resource');

update public.galleries g
set description = coalesce(s.introduction, '')
from public.seminars s
where g.source_type = 'seminar' and g.source_id = s.id;

update public.gallery_items gi
set caption = left(coalesce(nullif(f.alt_text, ''), g.title), 500)
from public.galleries g, public.files f
where gi.gallery_id = g.id
  and gi.file_id = f.id
  and g.source_type in ('post', 'resource');

update public.gallery_items gi
set caption = left(
  coalesce(nullif(f.alt_text, ''), nullif(g.description, ''), g.title),
  500
)
from public.galleries g, public.files f
where gi.gallery_id = g.id
  and gi.file_id = f.id
  and g.source_type = 'seminar';

revoke select on public.posts from anon;
grant select (id, board_id, organization_id, title, content, thumbnail_path,
  is_pinned, is_published, published_at, created_at, updated_at, tags,
  category, institution_id, status) on public.posts to anon;

revoke select on public.resources from anon;
grant select (id, category, title, reference_year, status, published_at,
  created_at, updated_at) on public.resources to anon;

revoke select on public.seminars from anon;
grant select (id, title, introduction, content, starts_at, ends_at, location,
  selection_method, selection_method_detail, capacity, registration_deadline,
  application_url, status, published_at, created_at, updated_at, is_featured)
on public.seminars to anon;

create function public.create_seminar_event(
  p_title text,
  p_topic text,
  p_starts_at timestamptz,
  p_location text,
  p_content text default '',
  p_ends_at timestamptz default null,
  p_capacity integer default null,
  p_application_method text default null,
  p_application_url text default null,
  p_registration_deadline timestamptz default null,
  p_thumbnail_path text default null,
  p_is_pinned boolean default false,
  p_is_published boolean default false,
  p_published_at timestamptz default null,
  p_tags text[] default array[]::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_board_id bigint;
  v_post_id uuid;
begin
  select b.id into v_board_id
  from public.boards b
  where b.code = 'seminar' and b.is_active = true
  limit 1;

  if v_board_id is null then
    raise exception '활성화된 seminar 게시판을 찾을 수 없습니다.';
  end if;

  insert into public.posts (
    board_id, organization_id, title, content, thumbnail_path, tags,
    is_pinned, is_published, published_at
  ) values (
    v_board_id, null, btrim(p_title), coalesce(p_content, ''),
    nullif(btrim(p_thumbnail_path), ''), coalesce(p_tags, array[]::text[]),
    p_is_pinned, p_is_published,
    case
      when p_is_published then coalesce(p_published_at, now())
      else null
    end
  )
  returning id into v_post_id;

  insert into public.seminar_events (
    post_id, topic, starts_at, ends_at, location, capacity,
    application_method, application_url, registration_deadline
  ) values (
    v_post_id, btrim(p_topic), p_starts_at, p_ends_at, btrim(p_location),
    p_capacity, nullif(btrim(p_application_method), ''),
    nullif(btrim(p_application_url), ''), p_registration_deadline
  );

  return v_post_id;
end;
$$;

create function public.update_seminar_event(
  p_post_id uuid,
  p_title text,
  p_topic text,
  p_starts_at timestamptz,
  p_location text,
  p_content text default '',
  p_ends_at timestamptz default null,
  p_capacity integer default null,
  p_application_method text default null,
  p_application_url text default null,
  p_registration_deadline timestamptz default null,
  p_thumbnail_path text default null,
  p_is_pinned boolean default false,
  p_is_published boolean default false,
  p_published_at timestamptz default null,
  p_tags text[] default array[]::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.posts p
    join public.boards b on b.id = p.board_id
    join public.seminar_events se on se.post_id = p.id
    where p.id = p_post_id and b.code = 'seminar'
  ) then
    raise exception '수정할 세미나 일정을 찾을 수 없습니다.';
  end if;

  update public.posts
  set title = btrim(p_title),
    content = coalesce(p_content, ''),
    thumbnail_path = nullif(btrim(p_thumbnail_path), ''),
    tags = coalesce(p_tags, array[]::text[]),
    is_pinned = p_is_pinned,
    is_published = p_is_published,
    published_at = case
      when p_is_published then coalesce(p_published_at, published_at, now())
      else null
    end
  where id = p_post_id;

  update public.seminar_events
  set topic = btrim(p_topic),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    location = btrim(p_location),
    capacity = p_capacity,
    application_method = nullif(btrim(p_application_method), ''),
    application_url = nullif(btrim(p_application_url), ''),
    registration_deadline = p_registration_deadline
  where post_id = p_post_id;

  return p_post_id;
end;
$$;

revoke all on function public.create_seminar_event(
  text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, boolean, boolean, timestamptz, text[]
) from public;
grant execute on function public.create_seminar_event(
  text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, boolean, boolean, timestamptz, text[]
) to authenticated;

revoke all on function public.update_seminar_event(
  uuid, text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, boolean, boolean, timestamptz, text[]
) from public;
grant execute on function public.update_seminar_event(
  uuid, text, text, timestamptz, text, text, timestamptz, integer, text, text,
  timestamptz, text, boolean, boolean, timestamptz, text[]
) to authenticated;

create function public.list_content_posts(
  p_page integer default 1,
  p_page_size integer default 10,
  p_category text default null,
  p_institution_id uuid default null,
  p_q text default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid,
  category text,
  title text,
  institution jsonb,
  cover jsonb,
  is_pinned boolean,
  published_at timestamptz,
  status text,
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
  select p.id, p.category, p.title,
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
      or p.title ilike '%' || btrim(p_q) || '%')
  order by p.is_pinned desc, p.published_at desc nulls last,
    p.created_at desc, p.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create function public.list_admin_content_posts(
  p_page integer default 1,
  p_page_size integer default 10,
  p_category text default null,
  p_institution_id uuid default null,
  p_q text default null,
  p_status text default null,
  p_admin boolean default false,
  p_published_from timestamptz default null,
  p_published_to timestamptz default null
)
returns table (
  id uuid,
  category text,
  title text,
  institution jsonb,
  cover jsonb,
  is_pinned boolean,
  published_at timestamptz,
  status text,
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
  if p_category is not null and p_category not in ('notice', 'association_news', 'member_news') then
    raise exception using errcode = '22023', message = 'invalid post category';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_published_from is not null and p_published_to is not null
    and p_published_from > p_published_to then
    raise exception using errcode = '22023', message = 'invalid published date range';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select p.id, p.category, p.title,
    case when i.id is null then null else jsonb_build_object(
      'id', i.id,
      'institution_type', i.institution_type,
      'name', i.name,
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
  left join public.files lf on lf.id = i.logo_file_id
  left join lateral (
    select f.*
    from public.post_files pf
    join public.files f on f.id = pf.file_id
    where pf.post_id = p.id and pf.role = 'cover'
    order by pf.sort_order, pf.created_at, pf.file_id
    limit 1
  ) cf on true
  where p.category is not null
    and (p_admin or (p.status = 'published' and p.published_at <= now()))
    and (p_category is null or p.category = p_category)
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (not p_admin or p_status is null or p.status = p_status)
    and (p_published_from is null or p.published_at >= p_published_from)
    and (p_published_to is null or p.published_at <= p_published_to)
    and (nullif(btrim(p_q), '') is null
      or p.title ilike '%' || btrim(p_q) || '%')
  order by p.is_pinned desc, p.published_at desc nulls last,
    p.created_at desc, p.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

revoke all on function public.list_content_posts(integer, integer, text, uuid, text, text, boolean) from public;
grant execute on function public.list_content_posts(integer, integer, text, uuid, text, text, boolean) to anon, authenticated;

revoke all on function public.list_admin_content_posts(integer, integer, text, uuid, text, text, boolean, timestamptz, timestamptz) from public;
grant execute on function public.list_admin_content_posts(integer, integer, text, uuid, text, text, boolean, timestamptz, timestamptz) to anon, authenticated;

create function public.list_resources(
  p_page integer default 1,
  p_page_size integer default 10,
  p_category text default null,
  p_q text default null,
  p_reference_year smallint default null,
  p_status text default null,
  p_admin boolean default false
)
returns table (
  id uuid,
  category text,
  title text,
  reference_year smallint,
  file_count bigint,
  published_at timestamptz,
  status text,
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
  if p_category is not null and p_category not in (
    'resource', 'financial_disclosure', 'seminar_material', 'law_policy',
    'annual_settlement', 'business_plan_budget', 'donation_usage', 'annual_report'
  ) then
    raise exception using errcode = '22023', message = 'invalid resource category';
  end if;
  if p_reference_year is not null and (p_reference_year < 1900 or p_reference_year > 2100) then
    raise exception using errcode = '22023', message = 'invalid reference year';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select r.id, r.category, r.title, r.reference_year,
    (select count(*) from public.resource_files rf where rf.resource_id = r.id),
    r.published_at, r.status, r.created_at, r.updated_at, count(*) over()
  from public.resources r
  where (p_admin or (r.status = 'published' and r.published_at <= now()))
    and (p_category is null or r.category = case p_category
      when 'resource' then 'seminar_material'
      when 'financial_disclosure' then 'annual_settlement'
      else p_category
    end)
    and (p_reference_year is null or r.reference_year = p_reference_year)
    and (not p_admin or p_status is null or r.status = p_status)
    and (nullif(btrim(p_q), '') is null
      or r.title ilike '%' || btrim(p_q) || '%')
  order by r.published_at desc nulls last, r.created_at desc, r.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create function public.list_resources(
  p_page integer default 1,
  p_page_size integer default 10,
  p_category text default null,
  p_q text default null,
  p_status text default null,
  p_admin boolean default false,
  p_published_from timestamptz default null,
  p_published_to timestamptz default null
)
returns table (
  id uuid,
  category text,
  title text,
  file_count bigint,
  published_at timestamptz,
  status text,
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
  if p_category is not null and p_category not in (
    'resource', 'financial_disclosure', 'seminar_material', 'law_policy',
    'annual_settlement', 'business_plan_budget', 'donation_usage', 'annual_report'
  ) then
    raise exception using errcode = '22023', message = 'invalid resource category';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_published_from is not null and p_published_to is not null
    and p_published_from > p_published_to then
    raise exception using errcode = '22023', message = 'invalid published date range';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select r.id, r.category, r.title,
    (select count(*) from public.resource_files rf where rf.resource_id = r.id),
    r.published_at, r.status, r.created_at, r.updated_at, count(*) over()
  from public.resources r
  where (p_admin or (r.status = 'published' and r.published_at <= now()))
    and (p_category is null or r.category = case p_category
      when 'resource' then 'seminar_material'
      when 'financial_disclosure' then 'annual_settlement'
      else p_category
    end)
    and (not p_admin or p_status is null or r.status = p_status)
    and (p_published_from is null or r.published_at >= p_published_from)
    and (p_published_to is null or r.published_at <= p_published_to)
    and (nullif(btrim(p_q), '') is null
      or r.title ilike '%' || btrim(p_q) || '%')
  order by r.published_at desc nulls last, r.created_at desc, r.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

revoke all on function public.list_resources(integer, integer, text, text, smallint, text, boolean) from public;
grant execute on function public.list_resources(integer, integer, text, text, smallint, text, boolean) to anon, authenticated;

revoke all on function public.list_resources(integer, integer, text, text, text, boolean, timestamptz, timestamptz) from public;
grant execute on function public.list_resources(integer, integer, text, text, text, boolean, timestamptz, timestamptz) to anon, authenticated;

create function public.list_seminars(
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
  id uuid,
  title text,
  introduction text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  poster jsonb,
  published_at timestamptz,
  status text,
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
  select s.id, s.title, s.introduction, s.starts_at, s.ends_at, s.location,
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

create function public.list_admin_seminars(
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
  if p_published_from is not null and p_published_to is not null
    and p_published_from > p_published_to then
    raise exception using errcode = '22023', message = 'invalid published date range';
  end if;
  if p_status is not null and p_status not in ('draft', 'published', 'hidden') then
    raise exception using errcode = '22023', message = 'invalid content status';
  end if;
  if p_admin and auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'admin read requires authentication';
  end if;

  return query
  select s.id, s.title, s.introduction, s.starts_at, s.ends_at, s.location,
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

revoke all on function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean) from public;
grant execute on function public.list_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean) to anon, authenticated;

revoke all on function public.list_admin_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz) from public;
grant execute on function public.list_admin_seminars(integer, integer, text, text, timestamptz, timestamptz, text, boolean, timestamptz, timestamptz) to anon, authenticated;
