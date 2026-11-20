-- Editorial achievement highlights for the public achievements page.

create table public.achievement_highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  occurred_on date not null,
  image_file_id uuid null references public.files(id) on delete set null,
  position integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievement_highlights_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint achievement_highlights_content_check check (char_length(btrim(content)) between 1 and 2000),
  constraint achievement_highlights_position_check check (position >= 0)
);

create trigger achievement_highlights_set_updated_at
before update on public.achievement_highlights
for each row execute function public.set_updated_at();

alter table public.achievement_highlights enable row level security;
revoke all on public.achievement_highlights from anon, authenticated;
grant select on public.achievement_highlights to anon;
grant select, insert, update, delete on public.achievement_highlights to authenticated;

create policy "public can read achievement highlights"
  on public.achievement_highlights for select to anon using (true);
create policy "authenticated can manage achievement highlights"
  on public.achievement_highlights for all to authenticated using (true) with check (true);

create or replace function public.save_achievement_highlight(
  p_title text,
  p_content text,
  p_occurred_on date,
  p_image_file_id uuid default null,
  p_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns public.achievement_highlights
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.achievement_highlights;
  next_position integer;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if char_length(btrim(p_title)) not between 1 and 160
    or char_length(btrim(p_content)) not between 1 and 2000 then
    raise invalid_parameter_value using message = 'invalid achievement highlight';
  end if;

  if p_id is null then
    perform pg_advisory_xact_lock(20261118, 12);
    select count(*) into next_position from public.achievement_highlights;
    if next_position >= 10 then raise check_violation using message = 'achievement highlight limit reached'; end if;
    insert into public.achievement_highlights (title, content, occurred_on, image_file_id, position)
    values (btrim(p_title), btrim(p_content), p_occurred_on, p_image_file_id, next_position)
    returning * into saved;
    return saved;
  end if;

  if p_expected_updated_at is null then raise invalid_parameter_value using message = 'expected_updated_at is required'; end if;
  select * into saved from public.achievement_highlights where id = p_id for update;
  if not found then raise no_data_found using message = 'achievement highlight not found'; end if;
  if saved.updated_at <> p_expected_updated_at then raise serialization_failure using message = 'achievement highlight changed'; end if;
  update public.achievement_highlights
  set title = btrim(p_title), content = btrim(p_content), occurred_on = p_occurred_on, image_file_id = p_image_file_id
  where id = p_id returning * into saved;
  return saved;
end;
$$;

create or replace function public.move_achievement_highlight(p_id uuid, p_direction smallint)
returns public.achievement_highlights language plpgsql security invoker set search_path = '' as $$
declare current_item public.achievement_highlights; target_item public.achievement_highlights;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if p_direction not in (-1, 1) then raise invalid_parameter_value using message = 'direction must be -1 or 1'; end if;
  perform pg_advisory_xact_lock(20261118, 12);
  select * into current_item from public.achievement_highlights where id = p_id for update;
  if not found then raise no_data_found using message = 'achievement highlight not found'; end if;
  select * into target_item from public.achievement_highlights
    where position = current_item.position + p_direction for update;
  if target_item.id is null then return current_item; end if;
  update public.achievement_highlights set position = 10000 where id = current_item.id;
  update public.achievement_highlights set position = current_item.position where id = target_item.id;
  update public.achievement_highlights set position = target_item.position where id = current_item.id returning * into current_item;
  return current_item;
end;
$$;

create or replace function public.delete_achievement_highlight(p_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare deleted_item public.achievement_highlights;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  perform pg_advisory_xact_lock(20261118, 12);
  delete from public.achievement_highlights where id = p_id returning * into deleted_item;
  if not found then raise no_data_found using message = 'achievement highlight not found'; end if;
  update public.achievement_highlights set position = position - 1 where position > deleted_item.position;
  return deleted_item.id;
end;
$$;

revoke all on function public.save_achievement_highlight(text, text, date, uuid, uuid, timestamptz), public.move_achievement_highlight(uuid, smallint), public.delete_achievement_highlight(uuid) from public, anon;
grant execute on function public.save_achievement_highlight(text, text, date, uuid, uuid, timestamptz), public.move_achievement_highlight(uuid, smallint), public.delete_achievement_highlight(uuid) to authenticated;
