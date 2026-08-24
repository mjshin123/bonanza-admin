-- =========================================================
-- KFCPA POST TAGS
-- =========================================================


-- =========================================================
-- 1. 게시물 복수 태그
-- =========================================================

alter table public.posts
add column tags text[] not null default array[]::text[];


alter table public.posts
add constraint posts_tags_count_check
check (cardinality(tags) <= 10);


alter table public.posts
add constraint posts_tags_null_element_check
check (array_position(tags, null) is null);


create index posts_tags_gin_idx
on public.posts
using gin (tags);


-- =========================================================
-- 2. 기존 세미나 생성·수정 RPC 시그니처 제거
-- =========================================================

drop function public.create_seminar_event(
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
);


drop function public.update_seminar_event(
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
);


-- =========================================================
-- 3. 태그를 포함한 세미나 게시물 + 일정 원자적 등록
-- =========================================================

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
  p_comment text default '',
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
    tags,
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
    coalesce(p_tags, array[]::text[]),
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
-- 4. 태그를 포함한 세미나 게시물 + 일정 원자적 수정
-- =========================================================

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
  p_comment text default '',
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
    tags = coalesce(p_tags, array[]::text[]),
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
-- 5. RPC 실행 권한
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
  timestamptz,
  text[]
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
  timestamptz,
  text[]
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
  timestamptz,
  text[]
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
  timestamptz,
  text[]
)
to authenticated;
