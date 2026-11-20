alter table public.history_entries add column if not exists is_featured boolean not null default false;
alter table public.history_entries add column if not exists featured_position integer null check (featured_position is null or featured_position >= 0);

create or replace function public.assign_featured_history_position() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_featured and (tg_op = 'INSERT' or not old.is_featured or new.featured_position is null) then
    select coalesce(max(featured_position) + 1, 0) into new.featured_position from public.history_entries where is_featured and id <> new.id;
  elsif not new.is_featured then new.featured_position := null; end if;
  return new;
end; $$;
create trigger history_entries_assign_featured_position before insert or update of is_featured on public.history_entries for each row execute function public.assign_featured_history_position();

create or replace function public.limit_featured_history_entries() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_featured and (tg_op = 'INSERT' or not old.is_featured) and (select count(*) from public.history_entries where is_featured) >= 10 then
    raise check_violation using message = 'featured history entry limit reached (maximum 10)';
  end if;
  return new;
end; $$;
create trigger history_entries_limit_featured before insert or update of is_featured on public.history_entries for each row execute function public.limit_featured_history_entries();

with next_position as (select coalesce(max(position) + 1, 0) as value from public.history_entries), numbered as (select h.*, row_number() over (order by h.position) - 1 as rn from public.achievement_highlights h)
insert into public.history_entries (year, month, title, content, detail, image_file_id, position, is_featured, featured_position)
select extract(year from occurred_on)::smallint, extract(month from occurred_on)::smallint, title, title, content, image_file_id, next_position.value + numbered.rn, true, numbered.rn from numbered cross join next_position;

create or replace function public.move_featured_history_entry(p_id uuid, p_direction smallint) returns uuid language plpgsql security invoker set search_path = '' as $$
declare current_item public.history_entries; target_item public.history_entries;
begin
  select * into current_item from public.history_entries where id=p_id and is_featured=true for update;
  if not found then raise no_data_found using message='featured history entry not found'; end if;
  select * into target_item from public.history_entries where is_featured=true and featured_position=(current_item.featured_position+p_direction) for update;
  if not found then return current_item.id; end if;
  update public.history_entries set featured_position=100000 where id=current_item.id;
  update public.history_entries set featured_position=current_item.featured_position where id=target_item.id;
  update public.history_entries set featured_position=target_item.featured_position where id=current_item.id;
  return current_item.id;
end; $$;
grant execute on function public.move_featured_history_entry(uuid, smallint) to authenticated;
