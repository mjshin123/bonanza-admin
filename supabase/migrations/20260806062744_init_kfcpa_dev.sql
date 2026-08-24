-- =========================================================
-- 1. 게시물
-- =========================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),

  board_type text not null
    check (
      board_type in (
        'notice',
        'gallery',
        'resource'
      )
    ),

  title text not null
    check (
      char_length(btrim(title)) between 1 and 200
    ),

  content text not null default '',

  thumbnail_path text,

  is_published boolean not null default false,

  published_at timestamptz,

  created_by uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


-- =========================================================
-- 2. 게시물 첨부파일 및 갤러리 이미지
-- =========================================================

create table public.post_files (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  file_kind text not null default 'attachment'
    check (
      file_kind in (
        'attachment',
        'gallery_image',
        'thumbnail'
      )
    ),

  storage_path text not null unique,

  original_name text not null,

  mime_type text not null,

  size_bytes bigint not null
    check (size_bytes >= 0),

  sort_order integer not null default 0
    check (sort_order >= 0),

  created_at timestamptz not null default now()
);


-- =========================================================
-- 3. updated_at 자동 변경
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();


-- =========================================================
-- 4. 조회용 인덱스
-- =========================================================

create index posts_public_list_idx
on public.posts (
  board_type,
  published_at desc,
  created_at desc
)
where is_published = true;

create index post_files_post_order_idx
on public.post_files (
  post_id,
  sort_order
);


-- =========================================================
-- 5. 테이블 권한
-- =========================================================

revoke all privileges
on table public.posts, public.post_files
from anon, authenticated;

-- 비로그인 사용자는 조회만 가능
grant select
on table public.posts, public.post_files
to anon;

-- 로그인한 사용자는 관리자이므로 전체 CRUD 가능
grant select, insert, update, delete
on table public.posts, public.post_files
to authenticated;


-- =========================================================
-- 6. RLS 활성화
-- =========================================================

alter table public.posts
enable row level security;

alter table public.post_files
enable row level security;


-- =========================================================
-- 7. posts RLS
-- =========================================================

-- 일반 사용자는 공개 게시물만 조회
create policy "anon can read published posts"
on public.posts
for select
to anon
using (
  is_published = true
);

-- 현재 시스템에서는 로그인 계정이 전부 관리자
create policy "authenticated users can manage posts"
on public.posts
for all
to authenticated
using (true)
with check (true);


-- =========================================================
-- 8. post_files RLS
-- =========================================================

-- 공개 게시물에 연결된 파일 정보만 조회
create policy "anon can read published post files"
on public.post_files
for select
to anon
using (
  exists (
    select 1
    from public.posts
    where public.posts.id = post_files.post_id
      and public.posts.is_published = true
  )
);

-- 관리자는 전체 파일 메타데이터 관리 가능
create policy "authenticated users can manage post files"
on public.post_files
for all
to authenticated
using (true)
with check (true);


-- =========================================================
-- 9. Supabase Storage RLS
-- public-assets 버킷은 다음 단계에서 생성
-- =========================================================

create policy "authenticated users can list public assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'public-assets'
);

create policy "authenticated users can upload public assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-assets'
);

create policy "authenticated users can update public assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'public-assets'
)
with check (
  bucket_id = 'public-assets'
);

create policy "authenticated users can delete public assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'public-assets'
);