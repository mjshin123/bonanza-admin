-- Manage the association history from Admin while keeping the public timeline simple.

create table public.history_entries (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  content text not null,
  position integer not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint history_entries_year_check check (year between 1900 and 2999),
  constraint history_entries_content_check check (
    char_length(btrim(content)) between 1 and 500
  ),
  constraint history_entries_position_check check (position >= 0),
  constraint history_entries_year_position_key
    unique (year, position) deferrable initially immediate
);

create index history_entries_public_order_idx
on public.history_entries (year desc, position, id)
where is_visible = true;

create trigger history_entries_set_updated_at
before update on public.history_entries
for each row execute function public.set_updated_at();

insert into public.history_entries (year, content, position) values
  (2026, '글로벌 금융범죄예방전문가 양성 프로그램 실시 (10~11월)', 0),
  (2026, '제1회 협회 회원사 워크숍 개최 (4월)', 1),
  (2026, '제3회 금융범죄예방세미나 개최 (4월)', 2),
  (2026, '재정경제부 **공익법인(구 지정기부금단체) 지정** (3월)', 3),
  (2025, '제3회 경찰청 국제사기방지 컨버런스 (9월)', 0),
  (2025, '경찰수사연수원 세미나개최 (4월)', 1),
  (2025, '제2회 금융범죄예방세미나개최 (4월)', 2),
  (2024, '제2회 경찰청 국제사기방지 컨퍼런스 (11월)', 0),
  (2024, '한국금융범죄예방협회 **본사무소 서울 종로 이전** (2월)', 1),
  (2023, '사우디아라비아 NAUSS 워크숍 참석 (11월)', 0),
  (2023, '제 1회 경찰청 국제사기방지 컨퍼런스 (9월)', 1),
  (2023, '싱가폴경찰청 및 인터폴 금융범죄 워크숍 참석 (7월)', 2),
  (2023, '**한국금융범죄예방협회 설립** (1월)', 3);

alter table public.history_entries enable row level security;

revoke all on table public.history_entries from anon, authenticated;
grant select on table public.history_entries to anon;
grant select, insert, update, delete on table public.history_entries to authenticated;

create policy "public can read visible history entries"
on public.history_entries for select to anon
using (is_visible = true);

create policy "authenticated can manage history entries"
on public.history_entries for all to authenticated
using (true) with check (true);

create or replace function public.save_history_entry(
  p_year smallint,
  p_content text,
  p_is_visible boolean default true,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.history_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_content text := btrim(p_content);
  previous_year smallint;
  next_position integer;
  saved_entry public.history_entries;
begin
  if auth.role() <> 'authenticated' then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if p_year not between 1900 and 2999
    or char_length(normalized_content) not between 1 and 500
  then
    raise invalid_parameter_value using message = 'invalid history entry';
  end if;

  if p_id is null then
    perform pg_advisory_xact_lock(20260827, p_year);
    select coalesce(max(h.position) + 1, 0)
      into next_position
      from public.history_entries h
      where h.year = p_year;
    insert into public.history_entries (year, content, position, is_visible)
    values (p_year, normalized_content, next_position, p_is_visible)
    returning * into saved_entry;
    return saved_entry;
  end if;

  if p_expected_updated_at is null then
    raise invalid_parameter_value using message = 'expected_updated_at is required';
  end if;

  select h.year into previous_year
  from public.history_entries h
  where h.id = p_id;
  if not found then
    raise no_data_found using message = 'history entry not found';
  end if;

  perform pg_advisory_xact_lock(20260827, least(previous_year, p_year));
  if previous_year <> p_year then
    perform pg_advisory_xact_lock(20260827, greatest(previous_year, p_year));
  end if;

  select * into saved_entry
  from public.history_entries h
  where h.id = p_id
  for update;
  if saved_entry.updated_at <> p_expected_updated_at then
    raise serialization_failure using message = 'history entry changed';
  end if;

  if saved_entry.year = p_year then
    next_position := saved_entry.position;
  else
    select coalesce(max(h.position) + 1, 0)
      into next_position
      from public.history_entries h
      where h.year = p_year;
  end if;

  update public.history_entries h
  set year = p_year,
      content = normalized_content,
      position = next_position,
      is_visible = p_is_visible
  where h.id = p_id
  returning * into saved_entry;
  return saved_entry;
end;
$$;

create or replace function public.move_history_entry(
  p_id uuid,
  p_direction smallint
)
returns public.history_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_entry public.history_entries;
  target_entry public.history_entries;
begin
  if auth.role() <> 'authenticated' then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if p_direction not in (-1, 1) then
    raise invalid_parameter_value using message = 'direction must be -1 or 1';
  end if;

  select * into current_entry
  from public.history_entries h
  where h.id = p_id;
  if not found then
    raise no_data_found using message = 'history entry not found';
  end if;

  perform pg_advisory_xact_lock(20260827, current_entry.year);
  select * into current_entry
  from public.history_entries h
  where h.id = p_id
  for update;

  if p_direction = -1 then
    select * into target_entry
    from public.history_entries h
    where h.year = current_entry.year
      and h.position < current_entry.position
    order by h.position desc
    limit 1
    for update;
  else
    select * into target_entry
    from public.history_entries h
    where h.year = current_entry.year
      and h.position > current_entry.position
    order by h.position
    limit 1
    for update;
  end if;

  if target_entry.id is null then
    return current_entry;
  end if;

  set constraints public.history_entries_year_position_key deferred;
  update public.history_entries
  set position = target_entry.position
  where id = current_entry.id;
  update public.history_entries
  set position = current_entry.position
  where id = target_entry.id;

  select * into current_entry
  from public.history_entries h
  where h.id = p_id;
  return current_entry;
end;
$$;

revoke all on function public.save_history_entry(smallint, text, boolean, uuid, timestamptz)
from public, anon;
grant execute on function public.save_history_entry(smallint, text, boolean, uuid, timestamptz)
to authenticated;

revoke all on function public.move_history_entry(uuid, smallint)
from public, anon;
grant execute on function public.move_history_entry(uuid, smallint)
to authenticated;
