-- External article links are available only for press releases.
alter table public.posts
  add column if not exists source_url text;

alter table public.posts
  drop constraint if exists posts_source_url_category_check;

alter table public.posts
  add constraint posts_source_url_category_check check (
    source_url is null or (
      category = 'association_news'
      and source_url ~* '^https?://[^[:space:]]+$'
    )
  );

grant select (source_url) on public.posts to anon;

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
  normalized_source_url text;
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

  normalized_source_url := nullif(btrim(coalesce(p_input ->> 'sourceUrl', '')), '');
  if normalized_source_url is not null and (
    p_input ->> 'category' <> 'association_news'
    or normalized_source_url !~* '^https?://[^[:space:]]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid press source URL';
  end if;

  if p_id is null then
    insert into public.posts (
      category, title, content, institution_id, status, is_pinned, published_at,
      source_url
    ) values (
      p_input ->> 'category', p_input ->> 'title',
      coalesce(p_input ->> 'content', ''),
      nullif(p_input ->> 'institutionId', '')::uuid,
      coalesce(p_input ->> 'status', 'draft'),
      coalesce((p_input ->> 'isPinned')::boolean, false),
      nullif(p_input ->> 'publishedAt', '')::timestamptz,
      normalized_source_url
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
      published_at = nullif(p_input ->> 'publishedAt', '')::timestamptz,
      source_url = normalized_source_url
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
