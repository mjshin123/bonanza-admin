alter table public.achievement_home_settings
  add column is_auto_sync boolean not null default true,
  add column metric_overrides jsonb not null default '{}'::jsonb,
  add constraint achievement_home_settings_metric_overrides_check check (jsonb_typeof(metric_overrides) = 'object');
