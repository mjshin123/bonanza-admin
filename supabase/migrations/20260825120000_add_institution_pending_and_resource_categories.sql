-- Separate public visibility from the institution registration state.
alter table public.institutions
  add column if not exists is_pending boolean not null default false;

comment on column public.institutions.is_pending is
  'True when the publicly visible institution is still scheduled for registration.';

-- Replace the two broad resource categories with the six public document types.
alter table public.resources
  drop constraint if exists resources_category_check;

alter table public.resources
  add constraint resources_category_check
  check (category in (
    'seminar_material',
    'law_policy',
    'annual_settlement',
    'business_plan_budget',
    'donation_usage',
    'annual_report'
  )) not valid;

update public.resources
set category = case category
  when 'resource' then 'seminar_material'
  when 'financial_disclosure' then 'annual_settlement'
  else category
end;

create or replace function public.list_resources(
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
  summary text,
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
    'resource',
    'financial_disclosure',
    'seminar_material',
    'law_policy',
    'annual_settlement',
    'business_plan_budget',
    'donation_usage',
    'annual_report'
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
  select r.id, r.category, r.title, r.summary, r.reference_year,
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
      or r.title ilike '%' || btrim(p_q) || '%'
      or r.summary ilike '%' || btrim(p_q) || '%')
  order by r.published_at desc nulls last, r.created_at desc, r.id desc
  limit p_page_size
  offset ((p_page - 1) * p_page_size);
end;
$$;

-- Keep the currently deployed admin compatible while the consumers are rolled out.
-- Legacy category inputs are normalized before they reach the six-value constraint.
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
      category, title, summary, reference_year, status, published_at
    ) values (
      normalized_category, p_input ->> 'title',
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
      category = normalized_category,
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
