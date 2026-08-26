-- Split institution categories into independent member/partner lists.
-- Existing categories keep their row when used by one type. Categories used
-- by both types are duplicated and partner institutions are repointed.

alter table public.institution_categories
  add column if not exists institution_type text;

alter table public.institution_categories
  drop constraint if exists institution_categories_code_key;
drop index if exists public.institution_categories_name_normalized_uidx;

do $$
declare
  category_row record;
  used_by_member boolean;
  used_by_partner boolean;
  partner_category_id uuid;
  partner_code text;
  code_suffix integer;
begin
  for category_row in
    select id, code, name, display_order, is_active
    from public.institution_categories
    where institution_type is null
  loop
    select exists (
      select 1
      from public.institutions
      where category_id = category_row.id
        and institution_type = 'member'
    ) into used_by_member;

    select exists (
      select 1
      from public.institutions
      where category_id = category_row.id
        and institution_type = 'partner'
    ) into used_by_partner;

    if used_by_member and used_by_partner then
      partner_code := category_row.code || '_partner';
      code_suffix := 1;

      while exists (
        select 1
        from public.institution_categories
        where code = partner_code
      ) loop
        code_suffix := code_suffix + 1;
        partner_code := category_row.code || '_partner' || code_suffix;
      end loop;

      insert into public.institution_categories (
        code, name, display_order, is_active, institution_type
      ) values (
        partner_code,
        category_row.name,
        category_row.display_order,
        category_row.is_active,
        'partner'
      )
      returning id into partner_category_id;

      update public.institutions
      set category_id = partner_category_id
      where category_id = category_row.id
        and institution_type = 'partner';

      update public.institution_categories
      set institution_type = 'member'
      where id = category_row.id;
    elsif used_by_partner then
      update public.institution_categories
      set institution_type = 'partner'
      where id = category_row.id;
    else
      update public.institution_categories
      set institution_type = 'member'
      where id = category_row.id;
    end if;
  end loop;
end;
$$;

alter table public.institution_categories
  alter column institution_type set not null;

alter table public.institution_categories
  add constraint institution_categories_institution_type_check
  check (institution_type in ('member', 'partner'));

alter table public.institution_categories
  add constraint institution_categories_type_code_key
  unique (institution_type, code);

alter table public.institution_categories
  add constraint institution_categories_id_type_key
  unique (id, institution_type);

create unique index institution_categories_name_normalized_uidx
  on public.institution_categories (
    institution_type,
    lower(btrim(name))
  );

drop index if exists public.institution_categories_public_order_idx;
create index institution_categories_public_order_idx
  on public.institution_categories (
    institution_type,
    display_order,
    name,
    id
  )
  where is_active = true;

alter table public.institutions
  add constraint institutions_category_type_fkey
  foreign key (category_id, institution_type)
  references public.institution_categories (id, institution_type)
  on delete restrict;

create or replace function public.swap_institution_category_order(
  p_first_id uuid,
  p_second_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_type text;
  second_type text;
  first_order integer;
  second_order integer;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select institution_type, display_order
  into first_type, first_order
  from public.institution_categories
  where id = p_first_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'first category not found';
  end if;

  select institution_type, display_order
  into second_type, second_order
  from public.institution_categories
  where id = p_second_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'second category not found';
  end if;

  if first_type <> second_type then
    raise exception using
      errcode = '22023',
      message = 'categories must have the same institution type';
  end if;

  update public.institution_categories
  set display_order = case id
    when p_first_id then second_order
    when p_second_id then first_order
  end
  where id in (p_first_id, p_second_id);
end;
$$;

revoke all on function public.swap_institution_category_order(uuid, uuid)
from public, anon;
grant execute on function public.swap_institution_category_order(uuid, uuid)
to authenticated;

grant select (
  id,
  code,
  name,
  institution_type,
  display_order,
  is_active,
  created_at,
  updated_at
) on public.institution_categories to anon;
