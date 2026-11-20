-- BONANZA FACTORY content schema v2
--
-- This is the expand/migrate phase of an expand-contract migration.  The
-- legacy boards/organizations/seminar_events tables and the legacy columns on
-- posts/post_files intentionally remain until the application transition and
-- production data verification have completed.

-- ---------------------------------------------------------------------------
-- Shared validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.enforce_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.created_by is distinct from old.created_by then
    if not (new.created_by is null and pg_trigger_depth() > 1) then
      raise exception using
        errcode = '23514',
        constraint = tg_table_name || '_created_by_immutable',
        message = 'created_by cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_uploaded_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
  elsif new.uploaded_by is distinct from old.uploaded_by then
    if not (new.uploaded_by is null and pg_trigger_depth() > 1) then
      raise exception using
        errcode = '23514',
        constraint = 'files_uploaded_by_immutable',
        message = 'uploaded_by cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_image_file_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referenced_file_id uuid;
begin
  referenced_file_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if referenced_file_id is not null and not exists (
    select 1 from public.files
    where id = referenced_file_id and file_kind = 'image'
  ) then
    raise exception using
      errcode = '23514',
      constraint = tg_table_name || '_' || tg_argv[0] || '_must_be_image',
      message = 'referenced file must be an image';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Central file metadata
-- ---------------------------------------------------------------------------

create table public.files (
  id uuid primary key default gen_random_uuid(),
  file_kind text not null check (file_kind in ('image', 'attachment')),
  bucket_name text not null default 'public-assets',
  storage_path text not null,
  original_name text not null
    check (char_length(btrim(original_name)) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  alt_text text check (alt_text is null or char_length(alt_text) <= 500),
  uploaded_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint files_bucket_path_key unique (bucket_name, storage_path),
  constraint files_kind_mime_check check (
    file_kind <> 'image' or mime_type like 'image/%'
  ),
  constraint files_kind_size_check check (
    (file_kind = 'image' and size_bytes <= 10485760)
    or (file_kind = 'attachment' and size_bytes <= 52428800)
  )
);

create index files_kind_created_idx
  on public.files (file_kind, created_at desc, id desc);
create index files_uploaded_by_idx on public.files (uploaded_by);

create trigger files_set_updated_at
before update on public.files for each row execute function public.set_updated_at();
create trigger files_enforce_uploaded_by
before insert or update on public.files for each row execute function public.enforce_uploaded_by();

create or replace function public.enforce_file_binary_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.file_kind is distinct from old.file_kind
    or new.bucket_name is distinct from old.bucket_name
    or new.storage_path is distinct from old.storage_path
    or new.original_name is distinct from old.original_name
    or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes
    or new.width_px is distinct from old.width_px
    or new.height_px is distinct from old.height_px
  then
    raise exception using
      errcode = '23514',
      constraint = 'files_binary_metadata_immutable',
      message = 'file binary metadata cannot be changed; create a new file instead';
  end if;
  return new;
end;
$$;

create trigger files_enforce_binary_immutability
before update on public.files for each row
execute function public.enforce_file_binary_immutability();

-- ---------------------------------------------------------------------------
-- Institutions
-- ---------------------------------------------------------------------------

create table public.institution_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (char_length(code) between 1 and 50 and code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institution_categories_name_normalized_uidx
  on public.institution_categories (lower(btrim(name)));
create index institution_categories_public_order_idx
  on public.institution_categories (display_order, name, id)
  where is_active = true;

insert into public.institution_categories (code, name, display_order)
values
  ('bank', '은행', 10),
  ('securities', '증권', 20),
  ('insurance', '보험', 30),
  ('virtual_asset', '가상자산', 40),
  ('electronic_finance_consulting', '전자금융·컨설팅', 50),
  ('uncategorized', '미분류', 999)
on conflict (code) do nothing;

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  institution_type text not null check (institution_type in ('member', 'partner')),
  category_id uuid not null
    references public.institution_categories(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  logo_file_id uuid references public.files(id) on delete restrict,
  description text not null default '',
  homepage_url text check (
    homepage_url is null
    or (char_length(homepage_url) <= 2048 and homepage_url ~* '^https?://')
  ),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institutions_name_normalized_uidx
  on public.institutions (lower(btrim(name)));
create index institutions_public_list_idx
  on public.institutions
  (institution_type, category_id, display_order, name, id)
  where is_active = true;
create index institutions_category_idx on public.institutions (category_id);
create index institutions_logo_file_idx on public.institutions (logo_file_id);

create trigger institution_categories_set_updated_at
before update on public.institution_categories for each row
execute function public.set_updated_at();
create trigger institution_categories_enforce_actor
before insert or update on public.institution_categories for each row
execute function public.enforce_created_by();
create trigger institutions_set_updated_at
before update on public.institutions for each row execute function public.set_updated_at();
create trigger institutions_enforce_actor
before insert or update on public.institutions for each row
execute function public.enforce_created_by();
create trigger institutions_validate_logo
before insert or update of logo_file_id on public.institutions for each row
execute function public.validate_image_file_reference('logo_file_id');

-- Preserve every current organization with its UUID.  The existing model did
-- not have a business category, so those rows start in the explicit fallback.
insert into public.institutions (
  id, institution_type, category_id, name, description, homepage_url,
  display_order, is_active, created_at, updated_at
)
select
  o.id,
  case when o.organization_type = 'member' then 'member' else 'partner' end,
  c.id,
  o.name,
  coalesce(o.description, ''),
  o.website_url,
  o.sort_order,
  o.is_active,
  o.created_at,
  o.updated_at
from public.organizations o
cross join public.institution_categories c
where c.code = 'uncategorized'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- News posts: add the v2 contract while retaining legacy compatibility fields
-- ---------------------------------------------------------------------------

alter table public.posts add column category text;
alter table public.posts add column summary text not null default '';
alter table public.posts add column institution_id uuid
  references public.institutions(id) on delete restrict;
alter table public.posts add column status text not null default 'draft';

alter table public.posts add constraint posts_category_v2_check
  check (category is null or category in ('notice', 'association_news', 'member_news'));
alter table public.posts add constraint posts_summary_v2_check
  check (char_length(summary) <= 500);
alter table public.posts add constraint posts_status_v2_check
  check (status in ('draft', 'published', 'hidden'));
alter table public.posts add constraint posts_published_at_v2_check
  check (status <> 'published' or published_at is not null);
alter table public.posts add constraint posts_institution_v2_check
  check (
    category is null
    or (category = 'member_news' and institution_id is not null)
    or (category <> 'member_news' and institution_id is null)
  );

update public.posts p
set
  category = case
    when b.code in ('notice', 'association_news', 'member_news') then b.code
    else null
  end,
  summary = coalesce(p.caption, ''),
  institution_id = case when b.code = 'member_news' then p.organization_id else null end,
  status = case when p.is_published then 'published' else 'draft' end,
  published_at = case when p.is_published
    then coalesce(p.published_at, p.created_at) else p.published_at end
from public.boards b
where b.id = p.board_id;

create index posts_v2_public_list_idx
  on public.posts
  (category, is_pinned desc, published_at desc, created_at desc, id desc)
  where status = 'published' and category is not null;
create index posts_institution_published_idx
  on public.posts (institution_id, published_at desc, id desc)
  where institution_id is not null;
create index posts_created_by_idx on public.posts (created_by);

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
    new.caption := new.summary;
    new.organization_id := new.institution_id;
    new.is_published := new.status = 'published';
  else
    select code into board_code from public.boards where id = new.board_id;
    if board_code in ('notice', 'association_news', 'member_news') then
      new.category := board_code;
      new.summary := coalesce(new.caption, '');
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
before insert or update of category, summary, institution_id, status,
  board_id, caption, organization_id, is_published, published_at
on public.posts for each row execute function public.sync_post_v2_legacy_fields();

create or replace function public.validate_member_news_institution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'member_news' and not exists (
    select 1 from public.institutions
    where id = new.institution_id and institution_type = 'member'
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'posts_member_news_requires_member_institution',
      message = 'member news must reference a member institution';
  end if;
  return new;
end;
$$;

create trigger posts_validate_member_institution
before insert or update of category, institution_id on public.posts for each row
execute function public.validate_member_news_institution();

create or replace function public.prevent_referenced_member_demotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.institution_type = 'member' and new.institution_type = 'partner'
    and exists (
      select 1 from public.posts
      where institution_id = old.id and category = 'member_news'
    )
  then
    raise exception using
      errcode = '23503',
      constraint = 'institutions_member_news_type_guard',
      message = 'institution is referenced by member news';
  end if;
  return new;
end;
$$;

create trigger institutions_prevent_member_demotion
before update of institution_type on public.institutions for each row
execute function public.prevent_referenced_member_demotion();

create trigger posts_enforce_actor
before insert or update on public.posts for each row execute function public.enforce_created_by();

-- ---------------------------------------------------------------------------
-- Split file metadata out of the legacy post_files table
-- ---------------------------------------------------------------------------

alter table public.post_files add column file_id uuid
  references public.files(id) on delete restrict;
alter table public.post_files add column role text
  check (role is null or role in ('cover', 'content'));
alter table public.post_files add constraint post_files_sort_order_v2_check
  check (sort_order >= 0);
alter table public.post_files drop constraint if exists post_files_storage_path_key;

insert into public.files (
  file_kind, bucket_name, storage_path, original_name, mime_type,
  size_bytes, created_at, updated_at
)
select
  case when pf.file_type = 'gallery_image' or pf.mime_type like 'image/%'
    then 'image' else 'attachment' end,
  'public-assets',
  pf.storage_path,
  pf.original_name,
  case when pf.file_type = 'gallery_image' and pf.mime_type is null
    then 'image/jpeg' else coalesce(pf.mime_type, 'application/octet-stream') end,
  least(
    greatest(coalesce(pf.size_bytes, 1), 1),
    case when pf.file_type = 'gallery_image' or pf.mime_type like 'image/%'
      then 10485760 else 52428800 end
  ),
  pf.created_at,
  pf.created_at
from public.post_files pf
on conflict (bucket_name, storage_path) do nothing;

update public.post_files pf
set
  file_id = f.id,
  role = case when f.file_kind = 'image' then 'content' else null end
from public.files f
where f.bucket_name = 'public-assets' and f.storage_path = pf.storage_path;

create unique index post_files_post_file_uidx
  on public.post_files (post_id, file_id) where file_id is not null;
create unique index post_files_one_cover_uidx
  on public.post_files (post_id) where role = 'cover';
create index post_files_v2_order_idx
  on public.post_files (post_id, role, sort_order, created_at, file_id)
  where file_id is not null;
create index post_files_file_idx on public.post_files (file_id)
  where file_id is not null;

create or replace function public.populate_legacy_post_file_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_row public.files%rowtype;
begin
  if new.file_id is not null then
    select * into file_row from public.files where id = new.file_id;
    if not found then
      raise exception using errcode = '23503', message = 'file not found';
    end if;
    new.storage_path := file_row.storage_path;
    new.original_name := file_row.original_name;
    new.mime_type := file_row.mime_type;
    new.size_bytes := file_row.size_bytes;
    new.file_type := case when file_row.file_kind = 'image'
      then 'gallery_image' else 'attachment' end;
    new.role := coalesce(new.role, 'content');
  end if;
  return new;
end;
$$;

create trigger post_files_populate_legacy_fields
before insert or update of file_id on public.post_files for each row
execute function public.populate_legacy_post_file_fields();
create trigger post_files_validate_image
before insert or update of file_id on public.post_files for each row
when (new.file_id is not null and new.role is not null)
execute function public.validate_image_file_reference('file_id');

-- Register legacy logos/thumbnails in the central catalog.  Storage metadata
-- may not be available during a remote migration, so a conservative byte value
-- is used only for these already-existing objects.
insert into public.files (
  file_kind, storage_path, original_name, mime_type, size_bytes
)
select distinct
  'image', o.logo_path,
  coalesce(nullif(regexp_replace(o.logo_path, '^.*/', ''), ''), 'logo'),
  case lower(substring(o.logo_path from '\.([^.]+)$'))
    when 'svg' then 'image/svg+xml' when 'png' then 'image/png'
    when 'webp' then 'image/webp' when 'gif' then 'image/gif'
    else 'image/jpeg' end,
  1
from public.organizations o
where o.logo_path is not null and btrim(o.logo_path) <> ''
on conflict (bucket_name, storage_path) do nothing;

update public.institutions i
set logo_file_id = f.id
from public.organizations o, public.files f
where o.id = i.id and f.bucket_name = 'public-assets'
  and f.storage_path = o.logo_path;

insert into public.files (
  file_kind, storage_path, original_name, mime_type, size_bytes
)
select distinct
  'image', p.thumbnail_path,
  coalesce(nullif(regexp_replace(p.thumbnail_path, '^.*/', ''), ''), 'thumbnail'),
  case lower(substring(p.thumbnail_path from '\.([^.]+)$'))
    when 'svg' then 'image/svg+xml' when 'png' then 'image/png'
    when 'webp' then 'image/webp' when 'gif' then 'image/gif'
    else 'image/jpeg' end,
  1
from public.posts p
where p.thumbnail_path is not null and btrim(p.thumbnail_path) <> ''
on conflict (bucket_name, storage_path) do nothing;

insert into public.post_files (
  post_id, file_id, role, sort_order, storage_path, original_name,
  mime_type, size_bytes, file_type
)
select p.id, f.id, 'cover', 0, f.storage_path, f.original_name,
  f.mime_type, f.size_bytes, 'gallery_image'
from public.posts p
join public.files f on f.bucket_name = 'public-assets'
  and f.storage_path = p.thumbnail_path
where p.category is not null
  and not exists (
    select 1 from public.post_files pf
    where pf.post_id = p.id and pf.role = 'cover'
  )
on conflict do nothing;

-- If a legacy thumbnail was already present as a content image, promote that
-- existing relation instead of attempting to insert the same file twice.
update public.post_files pf
set role = 'cover', sort_order = 0
from public.posts p, public.files f
where pf.post_id = p.id and pf.file_id = f.id
  and p.category is not null
  and f.bucket_name = 'public-assets' and f.storage_path = p.thumbnail_path
  and not exists (
    select 1 from public.post_files cover
    where cover.post_id = p.id and cover.role = 'cover'
  );

-- ---------------------------------------------------------------------------
-- Resources
-- ---------------------------------------------------------------------------

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('resource', 'financial_disclosure')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 500),
  reference_year smallint check (reference_year is null or reference_year between 1900 and 2100),
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_published_at_check check (status <> 'published' or published_at is not null)
);

create table public.resource_files (
  resource_id uuid not null references public.resources(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (resource_id, file_id)
);

create index resources_public_list_idx
  on public.resources (category, published_at desc, created_at desc, id desc)
  where status = 'published';
create index resources_category_year_idx
  on public.resources (category, reference_year desc, published_at desc, id desc);
create index resources_created_by_idx on public.resources (created_by);
create index resource_files_resource_order_idx
  on public.resource_files (resource_id, sort_order, created_at, file_id);
create index resource_files_file_idx on public.resource_files (file_id);
create trigger resources_set_updated_at
before update on public.resources for each row execute function public.set_updated_at();
create trigger resources_enforce_actor
before insert or update on public.resources for each row execute function public.enforce_created_by();

insert into public.resources (
  id, category, title, summary, status, published_at, created_by, created_at, updated_at
)
select p.id,
  case when b.code = 'financial_disclosure' then 'financial_disclosure' else 'resource' end,
  p.title, coalesce(p.caption, ''),
  case when p.is_published and exists (
    select 1 from public.post_files pf where pf.post_id = p.id and pf.file_id is not null
  ) then 'published' else 'draft' end,
  case when p.is_published then coalesce(p.published_at, p.created_at)
    else p.published_at end,
  p.created_by, p.created_at, p.updated_at
from public.posts p join public.boards b on b.id = p.board_id
where b.code in ('seminar_resource', 'policy_resource', 'financial_disclosure')
on conflict (id) do nothing;

insert into public.resource_files (resource_id, file_id, sort_order, created_at)
select r.id, pf.file_id, pf.sort_order, pf.created_at
from public.resources r join public.post_files pf on pf.post_id = r.id
where pf.file_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seminars
-- ---------------------------------------------------------------------------

create table public.seminars (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  introduction text not null default '',
  result_summary text not null default '',
  content text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null check (char_length(btrim(location)) between 1 and 300),
  selection_method text not null check (selection_method in ('first_come', 'lottery', 'other')),
  selection_method_detail text,
  capacity integer check (capacity is null or capacity > 0),
  registration_deadline timestamptz,
  application_url text check (
    application_url is null
    or (char_length(application_url) <= 2048 and application_url ~* '^https?://')
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seminars_time_check check (ends_at is null or ends_at >= starts_at),
  constraint seminars_deadline_check check (
    registration_deadline is null or registration_deadline <= starts_at
  ),
  constraint seminars_selection_detail_check check (
    selection_method <> 'other'
    or (selection_method_detail is not null and char_length(btrim(selection_method_detail)) > 0)
  ),
  constraint seminars_published_at_check check (status <> 'published' or published_at is not null)
);

create table public.seminar_files (
  seminar_id uuid not null references public.seminars(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  role text not null check (role in ('poster', 'photo')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (seminar_id, file_id)
);

create index seminars_public_starts_idx on public.seminars (starts_at, id)
  where status = 'published';
create index seminars_public_ends_idx
  on public.seminars ((coalesce(ends_at, starts_at)) desc, starts_at desc, id desc)
  where status = 'published';
create index seminars_registration_deadline_idx
  on public.seminars (registration_deadline) where registration_deadline is not null;
create index seminars_created_by_idx on public.seminars (created_by);
create index seminar_files_seminar_order_idx
  on public.seminar_files (seminar_id, role, sort_order, created_at, file_id);
create index seminar_files_file_idx on public.seminar_files (file_id);
create unique index seminar_files_one_poster_uidx
  on public.seminar_files (seminar_id) where role = 'poster';
create trigger seminars_set_updated_at
before update on public.seminars for each row execute function public.set_updated_at();
create trigger seminars_enforce_actor
before insert or update on public.seminars for each row execute function public.enforce_created_by();
create trigger seminar_files_validate_image
before insert or update of file_id on public.seminar_files for each row
execute function public.validate_image_file_reference('file_id');

insert into public.seminars (
  id, title, introduction, result_summary, content, starts_at, ends_at,
  location, selection_method, selection_method_detail, capacity,
  registration_deadline, application_url, status, published_at,
  created_by, created_at, updated_at
)
select p.id, p.title,
  case when coalesce(se.ends_at, se.starts_at) >= now() then coalesce(p.caption, '') else '' end,
  case when coalesce(se.ends_at, se.starts_at) < now() then coalesce(p.caption, '') else '' end,
  p.content, se.starts_at, se.ends_at, se.location,
  case
    when lower(coalesce(se.application_method, '')) similar to '%(추첨|lottery)%' then 'lottery'
    when lower(coalesce(se.application_method, '')) similar to '%(선착순|first)%' then 'first_come'
    else 'other'
  end,
  case
    when lower(coalesce(se.application_method, '')) similar to '%(추첨|lottery|선착순|first)%' then null
    else coalesce(nullif(btrim(se.application_method), ''), '별도 안내')
  end,
  se.capacity, se.registration_deadline, se.application_url,
  case when p.is_published then 'published' else 'draft' end,
  case when p.is_published then coalesce(p.published_at, p.created_at)
    else p.published_at end,
  p.created_by, p.created_at, greatest(p.updated_at, se.updated_at)
from public.posts p
join public.seminar_events se on se.post_id = p.id
on conflict (id) do nothing;

insert into public.seminar_files (seminar_id, file_id, role, sort_order, created_at)
select s.id, f.id, 'poster', 0, f.created_at
from public.seminars s
join public.posts p on p.id = s.id
join public.files f on f.bucket_name = 'public-assets' and f.storage_path = p.thumbnail_path
on conflict (seminar_id, file_id) do update set role = 'poster', sort_order = 0;

insert into public.seminar_files (seminar_id, file_id, role, sort_order, created_at)
select s.id, pf.file_id, 'photo', pf.sort_order, pf.created_at
from public.seminars s join public.post_files pf on pf.post_id = s.id
join public.files f on f.id = pf.file_id and f.file_kind = 'image'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Galleries
-- ---------------------------------------------------------------------------

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  event_date date,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  published_at timestamptz,
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint galleries_published_at_check check (status <> 'published' or published_at is not null)
);

create table public.gallery_items (
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  caption text not null default '' check (char_length(caption) <= 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (gallery_id, file_id)
);

create index galleries_public_list_idx
  on public.galleries (event_date desc, display_order, published_at desc, id desc)
  where status = 'published';
create index galleries_created_by_idx on public.galleries (created_by);
create index gallery_items_gallery_order_idx
  on public.gallery_items (gallery_id, sort_order, created_at, file_id);
create index gallery_items_file_idx on public.gallery_items (file_id);
create trigger galleries_set_updated_at
before update on public.galleries for each row execute function public.set_updated_at();
create trigger galleries_enforce_actor
before insert or update on public.galleries for each row execute function public.enforce_created_by();
create trigger gallery_items_validate_image
before insert or update of file_id on public.gallery_items for each row
execute function public.validate_image_file_reference('file_id');

insert into public.galleries (
  id, title, description, event_date, status, published_at,
  created_by, created_at, updated_at
)
select p.id, p.title, coalesce(p.caption, ''), p.published_at::date,
  case when p.is_published and exists (
    select 1 from public.post_files pf
    join public.files f on f.id = pf.file_id and f.file_kind = 'image'
    where pf.post_id = p.id
  ) then 'published' else 'draft' end,
  case when p.is_published then coalesce(p.published_at, p.created_at)
    else p.published_at end,
  p.created_by, p.created_at, p.updated_at
from public.posts p join public.boards b on b.id = p.board_id
where b.code = 'gallery'
on conflict (id) do nothing;

insert into public.gallery_items (gallery_id, file_id, sort_order, created_at)
select g.id, pf.file_id, pf.sort_order, pf.created_at
from public.galleries g join public.post_files pf on pf.post_id = g.id
join public.files f on f.id = pf.file_id and f.file_kind = 'image'
on conflict do nothing;

insert into public.gallery_items (gallery_id, file_id, sort_order, created_at)
select g.id, f.id, -1 + 1, f.created_at
from public.galleries g
join public.posts p on p.id = g.id
join public.files f on f.bucket_name = 'public-assets' and f.storage_path = p.thumbnail_path
where not exists (
  select 1 from public.gallery_items gi where gi.gallery_id = g.id and gi.file_id = f.id
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Deferred relationship invariants
-- ---------------------------------------------------------------------------

create or replace function public.validate_published_resource_has_file()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'resources' then
    target_id := new.id;
  elsif tg_op = 'DELETE' then
    target_id := old.resource_id;
  else
    target_id := new.resource_id;
    if old.resource_id is distinct from new.resource_id
      and exists (select 1 from public.resources where id = old.resource_id and status = 'published')
      and not exists (select 1 from public.resource_files where resource_id = old.resource_id)
    then
      raise exception using errcode = '23514', constraint = 'published_resource_requires_file',
        message = 'published resource requires at least one file';
    end if;
  end if;
  if exists (select 1 from public.resources where id = target_id and status = 'published')
    and not exists (select 1 from public.resource_files where resource_id = target_id)
  then
    raise exception using errcode = '23514', constraint = 'published_resource_requires_file',
      message = 'published resource requires at least one file';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create constraint trigger resources_require_file
after insert or update on public.resources deferrable initially deferred
for each row execute function public.validate_published_resource_has_file();
create constraint trigger resource_files_keep_published_parent_valid
after delete or update of resource_id on public.resource_files deferrable initially deferred
for each row execute function public.validate_published_resource_has_file();

create or replace function public.validate_published_gallery_has_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'galleries' then
    target_id := new.id;
  elsif tg_op = 'DELETE' then
    target_id := old.gallery_id;
  else
    target_id := new.gallery_id;
    if old.gallery_id is distinct from new.gallery_id
      and exists (select 1 from public.galleries where id = old.gallery_id and status = 'published')
      and not exists (select 1 from public.gallery_items where gallery_id = old.gallery_id)
    then
      raise exception using errcode = '23514', constraint = 'published_gallery_requires_item',
        message = 'published gallery requires at least one image';
    end if;
  end if;
  if exists (select 1 from public.galleries where id = target_id and status = 'published')
    and not exists (select 1 from public.gallery_items where gallery_id = target_id)
  then
    raise exception using errcode = '23514', constraint = 'published_gallery_requires_item',
      message = 'published gallery requires at least one image';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create constraint trigger galleries_require_item
after insert or update on public.galleries deferrable initially deferred
for each row execute function public.validate_published_gallery_has_item();
create constraint trigger gallery_items_keep_published_parent_valid
after delete or update of gallery_id on public.gallery_items deferrable initially deferred
for each row execute function public.validate_published_gallery_has_item();

-- Atomic stable reordering helpers used by the client API.
create or replace function public.reorder_content_files(
  p_relation text,
  p_parent_id uuid,
  p_file_ids uuid[]
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  expected_count integer;
  related_count integer;
  seminar_role text;
  seminar_max_role text;
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
    if expected_count <> cardinality(p_file_ids)
      or related_count <> cardinality(p_file_ids)
    then
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
    if expected_count <> cardinality(p_file_ids)
      or related_count <> cardinality(p_file_ids)
    then
      raise exception 'invalid resource file list';
    end if;
    update public.resource_files rf set sort_order = v.ordinality - 1
      from unnest(p_file_ids) with ordinality v(file_id, ordinality)
      where rf.resource_id = p_parent_id and rf.file_id = v.file_id;
  elsif p_relation = 'seminar_files' then
    select min(role), max(role), count(*)
      into seminar_role, seminar_max_role, expected_count
      from public.seminar_files
      where seminar_id = p_parent_id and file_id = any(p_file_ids);
    if expected_count <> cardinality(p_file_ids)
      or seminar_role is distinct from seminar_max_role
    then
      raise exception 'invalid seminar file list';
    end if;
    select count(*) into related_count from public.seminar_files
      where seminar_id = p_parent_id and role = seminar_role;
    if related_count <> cardinality(p_file_ids) then
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
    if expected_count <> cardinality(p_file_ids)
      or related_count <> cardinality(p_file_ids)
    then
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
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.files enable row level security;
alter table public.institution_categories enable row level security;
alter table public.institutions enable row level security;
alter table public.resources enable row level security;
alter table public.resource_files enable row level security;
alter table public.seminars enable row level security;
alter table public.seminar_files enable row level security;
alter table public.galleries enable row level security;
alter table public.gallery_items enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'files', 'institution_categories', 'institutions', 'resources',
    'resource_files', 'seminars', 'seminar_files', 'galleries', 'gallery_items'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'authenticated can manage ' || table_name, table_name
    );
  end loop;
end $$;

revoke all on function public.reorder_content_files(text, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_content_files(text, uuid, uuid[]) to authenticated;
grant select (id, file_kind, bucket_name, storage_path, original_name, mime_type,
  size_bytes, width_px, height_px, alt_text, created_at, updated_at)
on public.files to anon;
grant select (id, code, name, display_order, is_active, created_at, updated_at)
on public.institution_categories to anon;
grant select (id, institution_type, category_id, name, logo_file_id, description,
  homepage_url, display_order, is_active, created_at, updated_at)
on public.institutions to anon;
grant select (id, category, title, summary, reference_year, status, published_at,
  created_at, updated_at) on public.resources to anon;
grant select on public.resource_files to anon;
grant select (id, title, introduction, result_summary, content, starts_at, ends_at,
  location, selection_method, selection_method_detail, capacity,
  registration_deadline, application_url, status, published_at, created_at,
  updated_at) on public.seminars to anon;
grant select on public.seminar_files to anon;
grant select (id, title, description, event_date, status, published_at,
  display_order, created_at, updated_at) on public.galleries to anon;
grant select on public.gallery_items to anon;

create policy "public can read active institution categories"
on public.institution_categories for select to anon using (is_active = true);
create policy "public can read active institutions"
on public.institutions for select to anon using (
  is_active = true and exists (
    select 1 from public.institution_categories c
    where c.id = institutions.category_id and c.is_active = true
  )
);
create policy "public can read published resources"
on public.resources for select to anon using (
  status = 'published' and published_at <= now()
);
create policy "public can read published resource files"
on public.resource_files for select to anon using (
  exists (select 1 from public.resources r where r.id = resource_id
    and r.status = 'published' and r.published_at <= now())
);
create policy "public can read published seminars"
on public.seminars for select to anon using (
  status = 'published' and published_at <= now()
);
create policy "public can read published seminar files"
on public.seminar_files for select to anon using (
  exists (select 1 from public.seminars s where s.id = seminar_id
    and s.status = 'published' and s.published_at <= now())
);
create policy "public can read published galleries"
on public.galleries for select to anon using (
  status = 'published' and published_at <= now()
);
create policy "public can read published gallery items"
on public.gallery_items for select to anon using (
  exists (select 1 from public.galleries g where g.id = gallery_id
    and g.status = 'published' and g.published_at <= now())
);
create policy "public can read referenced files"
on public.files for select to anon using (
  exists (select 1 from public.institutions i
    join public.institution_categories c on c.id = i.category_id
    where i.logo_file_id = files.id and i.is_active and c.is_active)
  or exists (select 1 from public.post_files pf join public.posts p on p.id = pf.post_id
    where pf.file_id = files.id and p.status = 'published' and p.published_at <= now())
  or exists (select 1 from public.resource_files rf join public.resources r on r.id = rf.resource_id
    where rf.file_id = files.id and r.status = 'published' and r.published_at <= now())
  or exists (select 1 from public.seminar_files sf join public.seminars s on s.id = sf.seminar_id
    where sf.file_id = files.id and s.status = 'published' and s.published_at <= now())
  or exists (select 1 from public.gallery_items gi join public.galleries g on g.id = gi.gallery_id
    where gi.file_id = files.id and g.status = 'published' and g.published_at <= now())
);

drop policy if exists "public can read published posts" on public.posts;
create policy "public can read published posts"
on public.posts for select to anon using (
  (
    category is not null and status = 'published' and published_at <= now()
    and (
      category <> 'member_news'
      or exists (select 1 from public.institutions i
        join public.institution_categories c on c.id = i.category_id
        where i.id = institution_id and i.is_active and c.is_active
          and i.institution_type = 'member')
    )
  )
  or (
    category is null and is_published = true
    and exists (select 1 from public.boards b where b.id = board_id and b.is_active)
  )
);

drop policy if exists "public can read published post files" on public.post_files;
create policy "public can read published post files"
on public.post_files for select to anon using (
  exists (
    select 1 from public.posts p join public.boards b on b.id = p.board_id
    where p.id = post_id and b.is_active and (
      (p.category is not null and file_id is not null and role is not null
        and p.status = 'published' and p.published_at <= now())
      or (p.category is null and p.is_published = true)
    )
  )
);

revoke select on public.posts from anon;
grant select (id, board_id, organization_id, title, content, thumbnail_path,
  is_pinned, is_published, published_at, created_at, updated_at, caption, tags,
  category, summary, institution_id, status) on public.posts to anon;

-- Public object reads use the public bucket URL.  Only authenticated admins can
-- mutate objects through the Storage API.
drop policy if exists "authenticated can upload public assets" on storage.objects;
drop policy if exists "authenticated can update public assets" on storage.objects;
drop policy if exists "authenticated can delete public assets" on storage.objects;
create policy "authenticated can upload public assets" on storage.objects
for insert to authenticated with check (bucket_id = 'public-assets');
create policy "authenticated can update public assets" on storage.objects
for update to authenticated using (bucket_id = 'public-assets')
with check (bucket_id = 'public-assets');
create policy "authenticated can delete public assets" on storage.objects
for delete to authenticated using (bucket_id = 'public-assets');

update storage.buckets
set public = true, file_size_limit = 52428800
where id = 'public-assets';
