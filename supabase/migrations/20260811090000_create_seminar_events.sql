-- =========================================================
-- BONANZA FACTORY SEMINAR EVENTS
-- =========================================================


-- =========================================================
-- 1. 세미나 일정 상세
-- =========================================================

create table public.seminar_events (
  post_id uuid primary key
    references public.posts(id)
    on delete cascade,

  topic text not null
    check (
      char_length(btrim(topic)) between 1 and 200
    ),

  starts_at timestamptz not null,

  ends_at timestamptz,

  location text not null
    check (
      char_length(btrim(location)) between 1 and 300
    ),

  capacity integer
    check (
      capacity is null or capacity > 0
    ),

  application_method text,

  application_url text,

  registration_deadline timestamptz,

  comment text not null default '',

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint seminar_events_time_order_check
    check (
      ends_at is null or ends_at >= starts_at
    ),

  constraint seminar_events_registration_deadline_check
    check (
      registration_deadline is null
      or registration_deadline <= starts_at
    )
);


create trigger seminar_events_set_updated_at
before update on public.seminar_events
for each row
execute function public.set_updated_at();


create index seminar_events_starts_at_idx
on public.seminar_events (
  starts_at
);


-- =========================================================
-- 2. RLS 및 권한
-- =========================================================

alter table public.seminar_events
enable row level security;


revoke all privileges
on table public.seminar_events
from anon, authenticated;


grant select
on table public.seminar_events
to anon;


grant select, insert, update, delete
on table public.seminar_events
to authenticated;


create policy "public can read published seminar events"
on public.seminar_events
for select
to anon
using (
  exists (
    select 1
    from public.posts
    join public.boards
      on boards.id = posts.board_id
    where posts.id = seminar_events.post_id
      and posts.is_published = true
      and boards.code = 'seminar'
      and boards.is_active = true
  )
);


create policy "authenticated can manage seminar events"
on public.seminar_events
for all
to authenticated
using (
  exists (
    select 1
    from public.posts
    join public.boards
      on boards.id = posts.board_id
    where posts.id = seminar_events.post_id
      and boards.code = 'seminar'
  )
)
with check (
  exists (
    select 1
    from public.posts
    join public.boards
      on boards.id = posts.board_id
    where posts.id = seminar_events.post_id
      and boards.code = 'seminar'
  )
);


-- =========================================================
-- 3. 세미나 게시물 + 일정 원자적 등록
-- =========================================================

create or replace function public.create_seminar_event(
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
  p_comment text default '',
  p_thumbnail_path text default null,
  p_is_pinned boolean default false,
  p_is_published boolean default false,
  p_published_at timestamptz default null
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
  select boards.id
  into v_board_id
  from public.boards
  where boards.code = 'seminar'
    and boards.is_active = true
  limit 1;

  if v_board_id is null then
    raise exception '활성화된 seminar 게시판을 찾을 수 없습니다.';
  end if;

  insert into public.posts (
    board_id,
    organization_id,
    title,
    content,
    thumbnail_path,
    is_pinned,
    is_published,
    published_at
  )
  values (
    v_board_id,
    null,
    btrim(p_title),
    coalesce(p_content, ''),
    nullif(btrim(p_thumbnail_path), ''),
    p_is_pinned,
    p_is_published,
    case
      when p_is_published then coalesce(p_published_at, now())
      else null
    end
  )
  returning id into v_post_id;

  insert into public.seminar_events (
    post_id,
    topic,
    starts_at,
    ends_at,
    location,
    capacity,
    application_method,
    application_url,
    registration_deadline,
    comment
  )
  values (
    v_post_id,
    btrim(p_topic),
    p_starts_at,
    p_ends_at,
    btrim(p_location),
    p_capacity,
    nullif(btrim(p_application_method), ''),
    nullif(btrim(p_application_url), ''),
    p_registration_deadline,
    coalesce(p_comment, '')
  );

  return v_post_id;
end;
$$;


-- =========================================================
-- 4. 세미나 게시물 + 일정 원자적 수정
-- =========================================================

create or replace function public.update_seminar_event(
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
  p_comment text default '',
  p_thumbnail_path text default null,
  p_is_pinned boolean default false,
  p_is_published boolean default false,
  p_published_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.posts
    join public.boards
      on boards.id = posts.board_id
    join public.seminar_events
      on seminar_events.post_id = posts.id
    where posts.id = p_post_id
      and boards.code = 'seminar'
  ) then
    raise exception '수정할 세미나 일정을 찾을 수 없습니다.';
  end if;

  update public.posts
  set
    title = btrim(p_title),
    content = coalesce(p_content, ''),
    thumbnail_path = nullif(btrim(p_thumbnail_path), ''),
    is_pinned = p_is_pinned,
    is_published = p_is_published,
    published_at = case
      when p_is_published then coalesce(p_published_at, published_at, now())
      else null
    end
  where id = p_post_id;

  update public.seminar_events
  set
    topic = btrim(p_topic),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    location = btrim(p_location),
    capacity = p_capacity,
    application_method = nullif(btrim(p_application_method), ''),
    application_url = nullif(btrim(p_application_url), ''),
    registration_deadline = p_registration_deadline,
    comment = coalesce(p_comment, '')
  where post_id = p_post_id;

  return p_post_id;
end;
$$;


-- =========================================================
-- 5. 세미나 게시물 + 일정 원자적 삭제
-- =========================================================

create or replace function public.delete_seminar_event(
  p_post_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.posts
    join public.boards
      on boards.id = posts.board_id
    join public.seminar_events
      on seminar_events.post_id = posts.id
    where posts.id = p_post_id
      and boards.code = 'seminar'
  ) then
    raise exception '삭제할 세미나 일정을 찾을 수 없습니다.';
  end if;

  delete from public.posts
  where id = p_post_id;

  return p_post_id;
end;
$$;


-- =========================================================
-- 6. RPC 실행 권한
-- =========================================================

revoke all
on function public.create_seminar_event(
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  boolean,
  timestamptz
)
from public, anon;


grant execute
on function public.create_seminar_event(
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  boolean,
  timestamptz
)
to authenticated;


revoke all
on function public.update_seminar_event(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  boolean,
  timestamptz
)
from public, anon;


grant execute
on function public.update_seminar_event(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  integer,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  boolean,
  timestamptz
)
to authenticated;


revoke all
on function public.delete_seminar_event(uuid)
from public, anon;


grant execute
on function public.delete_seminar_event(uuid)
to authenticated;
