alter table public.history_entries add column title text;
alter table public.history_entries add column month smallint not null default 1 check (month between 1 and 12);
alter table public.history_entries add column detail text null check (detail is null or char_length(btrim(detail)) <= 2000);
alter table public.history_entries add column image_file_id uuid null references public.files(id) on delete set null;
update public.history_entries set title = content where title is null;
alter table public.history_entries alter column title set not null;
alter table public.history_entries add constraint history_entries_title_check check (char_length(btrim(title)) between 1 and 160);

create or replace function public.save_history_entry_v2(
  p_title text, p_year smallint, p_month smallint, p_detail text default null, p_image_file_id uuid default null,
  p_id uuid default null, p_expected_updated_at timestamptz default null
) returns public.history_entries language plpgsql security invoker set search_path = '' as $$
declare saved public.history_entries; next_position integer;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if p_year not between 1900 and 2999 or p_month not between 1 and 12 or char_length(btrim(p_title)) not between 1 and 160 or (p_detail is not null and char_length(btrim(p_detail)) > 2000) then raise invalid_parameter_value using message = 'invalid history entry'; end if;
  if p_id is null then
    perform pg_advisory_xact_lock(20261118, p_year);
    select coalesce(max(position) + 1, 0) into next_position from public.history_entries where year = p_year;
    insert into public.history_entries (year, month, title, content, detail, image_file_id, position) values (p_year, p_month, btrim(p_title), btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), p_image_file_id, next_position) returning * into saved;
    return saved;
  end if;
  if p_expected_updated_at is null then raise invalid_parameter_value using message = 'expected_updated_at is required'; end if;
  select * into saved from public.history_entries where id = p_id for update;
  if not found then raise no_data_found using message = 'history entry not found'; end if;
  if saved.updated_at <> p_expected_updated_at then raise serialization_failure using message = 'history entry changed'; end if;
  update public.history_entries set year = p_year, month = p_month, title = btrim(p_title), content = btrim(p_title), detail = nullif(btrim(coalesce(p_detail, '')), ''), image_file_id = p_image_file_id where id = p_id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_history_entry_v2(text, smallint, smallint, text, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.save_history_entry_v2(text, smallint, smallint, text, uuid, uuid, timestamptz) to authenticated;
