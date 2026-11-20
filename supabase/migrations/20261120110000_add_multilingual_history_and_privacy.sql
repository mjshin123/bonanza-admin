alter table public.history_entries
  add column if not exists title_en text null,
  add column if not exists detail_en text null;

alter table public.history_entries
  add constraint history_entries_title_en_check
  check (title_en is null or char_length(btrim(title_en)) between 1 and 160);

alter table public.history_entries
  add constraint history_entries_detail_en_check
  check (detail_en is null or char_length(btrim(detail_en)) <= 2000);

create or replace function public.save_history_entry_v2(
  p_title text, p_year smallint, p_month smallint, p_detail text default null,
  p_image_file_id uuid default null, p_id uuid default null,
  p_expected_updated_at timestamptz default null, p_title_en text default null,
  p_detail_en text default null
) returns public.history_entries language plpgsql security invoker set search_path = '' as $$
declare saved public.history_entries; next_position integer;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if p_year not between 1900 and 2999 or p_month not between 1 and 12
    or char_length(btrim(p_title)) not between 1 and 160
    or (p_title_en is not null and char_length(btrim(p_title_en)) not between 1 and 160)
    or (p_detail is not null and char_length(btrim(p_detail)) > 2000)
    or (p_detail_en is not null and char_length(btrim(p_detail_en)) > 2000) then
    raise invalid_parameter_value using message = 'invalid history entry';
  end if;
  if p_id is null then
    perform pg_advisory_xact_lock(20261118, p_year);
    select coalesce(max(position) + 1, 0) into next_position from public.history_entries where year = p_year;
    insert into public.history_entries (year, month, title, title_en, content, detail, detail_en, image_file_id, position)
    values (p_year, p_month, btrim(p_title), nullif(btrim(coalesce(p_title_en, '')), ''), btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), nullif(btrim(coalesce(p_detail_en, '')), ''), p_image_file_id, next_position)
    returning * into saved;
    return saved;
  end if;
  if p_expected_updated_at is null then raise invalid_parameter_value using message = 'expected_updated_at is required'; end if;
  select * into saved from public.history_entries where id = p_id for update;
  if not found then raise no_data_found using message = 'history entry not found'; end if;
  if saved.updated_at <> p_expected_updated_at then raise serialization_failure using message = 'history entry changed'; end if;
  update public.history_entries set year = p_year, month = p_month, title = btrim(p_title), title_en = nullif(btrim(coalesce(p_title_en, '')), ''), content = btrim(p_title), detail = nullif(btrim(coalesce(p_detail, '')), ''), detail_en = nullif(btrim(coalesce(p_detail_en, '')), ''), image_file_id = p_image_file_id where id = p_id returning * into saved;
  return saved;
end;
$$;

alter table public.privacy_policies add column if not exists content_en text null;
