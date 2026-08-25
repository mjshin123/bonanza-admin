-- Institution categories were shared between member and partner institutions.
-- Split them per institution_type so the admin can manage each type's category
-- list independently. Categories currently used by only one type keep their
-- row; categories used by both types are duplicated so each type keeps its
-- own row (existing institutions are repointed to the correct copy).

alter table public.institution_categories
  add column if not exists institution_type text;

-- Old constraints assumed a single shared list (globally unique code/name).
-- Drop them before backfilling so the duplication step below (same name,
-- different institution_type) is not rejected.
alter table public.institution_categories
  drop constraint institution_categories_code_key;
drop index public.institution_categories_name_normalized_uidx;

do $$
declare
  cat record;
  used_member boolean;
  used_partner boolean;
  new_id uuid;
  new_code text;
  suffix int;
begin
  for cat in select id, code, name, display_order, is_active
             from public.institution_categories
  loop
    select exists(
      select 1 from public.institutions
      where category_id = cat.id and institution_type = 'member'
    ) into used_member;
    select exists(
      select 1 from public.institutions
      where category_id = cat.id and institution_type = 'partner'
    ) into used_partner;

    if used_member and used_partner then
      new_code := cat.code || '_partner';
      suffix := 1;
      while exists(select 1 from public.institution_categories where code = new_code) loop
        suffix := suffix + 1;
        new_code := cat.code || '_partner' || suffix;
      end loop;

      insert into public.institution_categories
        (code, name, display_order, is_active, institution_type)
      values
        (new_code, cat.name, cat.display_order, cat.is_active, 'partner')
      returning id into new_id;

      update public.institutions
        set category_id = new_id
        where category_id = cat.id and institution_type = 'partner';

      update public.institution_categories
        set institution_type = 'member'
        where id = cat.id;
    elsif used_partner then
      update public.institution_categories
        set institution_type = 'partner'
        where id = cat.id;
    else
      update public.institution_categories
        set institution_type = 'member'
        where id = cat.id;
    end if;
  end loop;
end $$;

alter table public.institution_categories
  alter column institution_type set not null;
alter table public.institution_categories
  add constraint institution_categories_institution_type_check
  check (institution_type in ('member', 'partner'));

-- Uniqueness moves from global to per-type, since both types now keep
-- independent category lists that may reuse the same code/name.
alter table public.institution_categories
  add constraint institution_categories_type_code_key unique (institution_type, code);
create unique index institution_categories_name_normalized_uidx
  on public.institution_categories (institution_type, lower(btrim(name)));

drop index public.institution_categories_public_order_idx;
create index institution_categories_public_order_idx
  on public.institution_categories (institution_type, display_order, name, id)
  where is_active = true;

grant select (id, code, name, institution_type, display_order, is_active, created_at, updated_at)
on public.institution_categories to anon;
