create table public.achievement_home_settings (
  id boolean primary key default true check (id),
  source text not null check (char_length(btrim(source)) between 1 and 100),
  source_en text not null check (char_length(btrim(source_en)) between 1 and 100),
  updated_at timestamptz not null default now()
);

insert into public.achievement_home_settings (id, source, source_en)
values (true, 'TranSight, TranSafer 2026.10 기준', 'TranSight, TranSafer as of Oct 2026');

create trigger achievement_home_settings_set_updated_at
before update on public.achievement_home_settings
for each row execute function public.set_updated_at();

alter table public.achievement_home_settings enable row level security;
revoke all on public.achievement_home_settings from anon, authenticated;
grant select on public.achievement_home_settings to anon;
grant select, update on public.achievement_home_settings to authenticated;

create policy "public can read home achievement settings"
  on public.achievement_home_settings for select to anon using (true);
create policy "authenticated can manage home achievement settings"
  on public.achievement_home_settings for all to authenticated using (true) with check (true);
