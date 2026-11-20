alter table public.awards
  add column if not exists title_en text null,
  add column if not exists organization_en text null;

alter table public.awards
  add constraint awards_title_en_check
  check (title_en is null or char_length(btrim(title_en)) <= 160);

alter table public.awards
  add constraint awards_organization_en_check
  check (organization_en is null or char_length(btrim(organization_en)) <= 160);

create or replace function public.save_award(
  p_title text, p_organization text, p_awarded_on date, p_id uuid default null,
  p_expected_updated_at timestamptz default null, p_title_en text default null,
  p_organization_en text default null
) returns public.awards language plpgsql security invoker set search_path = '' as $$
declare saved public.awards;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if char_length(btrim(p_title)) not between 1 and 160 or char_length(btrim(p_organization)) not between 1 and 160
    or (p_title_en is not null and char_length(btrim(p_title_en)) > 160)
    or (p_organization_en is not null and char_length(btrim(p_organization_en)) > 160) then
    raise invalid_parameter_value using message = 'invalid award';
  end if;
  if p_id is null then
    insert into public.awards (title, title_en, organization, organization_en, awarded_on)
    values (btrim(p_title), nullif(btrim(coalesce(p_title_en, '')), ''), btrim(p_organization), nullif(btrim(coalesce(p_organization_en, '')), ''), p_awarded_on)
    returning * into saved;
    return saved;
  end if;
  if p_expected_updated_at is null then raise invalid_parameter_value using message = 'expected_updated_at is required'; end if;
  select * into saved from public.awards where id = p_id for update;
  if not found then raise no_data_found using message = 'award not found'; end if;
  if saved.updated_at <> p_expected_updated_at then raise serialization_failure using message = 'award changed'; end if;
  update public.awards set title = btrim(p_title), title_en = nullif(btrim(coalesce(p_title_en, '')), ''), organization = btrim(p_organization), organization_en = nullif(btrim(coalesce(p_organization_en, '')), ''), awarded_on = p_awarded_on where id = p_id returning * into saved;
  return saved;
end;
$$;
