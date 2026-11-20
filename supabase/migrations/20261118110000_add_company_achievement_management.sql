-- Company achievements are authored in their company-introduction order.
-- The home page only projects rows marked show_on_home; it owns no duplicate metrics.

create table public.achievement_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text not null,
  title_en text not null,
  source text not null,
  source_en text not null,
  position integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievement_sections_key_check check (section_key ~ '^[a-z0-9_-]+$'),
  constraint achievement_sections_title_check check (char_length(btrim(title)) between 1 and 200),
  constraint achievement_sections_position_check check (position >= 0)
);

create table public.achievement_metrics (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.achievement_sections(id) on delete cascade,
  metric_key text not null unique,
  label text not null,
  label_en text not null,
  display_value text not null,
  display_value_en text not null,
  unit text not null,
  unit_en text not null,
  counter_target numeric null,
  position integer not null,
  show_on_home boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievement_metrics_key_check check (metric_key ~ '^[a-z0-9_-]+$'),
  constraint achievement_metrics_label_check check (char_length(btrim(label)) between 1 and 100),
  constraint achievement_metrics_value_check check (char_length(btrim(display_value)) between 1 and 30),
  constraint achievement_metrics_target_check check (counter_target is null or counter_target >= 0),
  constraint achievement_metrics_position_check check (position >= 0),
  constraint achievement_metrics_section_position_key unique (section_id, position)
);

create index achievement_metrics_home_order_idx
  on public.achievement_metrics (section_id, position)
  where show_on_home = true;

create trigger achievement_sections_set_updated_at
before update on public.achievement_sections
for each row execute function public.set_updated_at();

create trigger achievement_metrics_set_updated_at
before update on public.achievement_metrics
for each row execute function public.set_updated_at();

insert into public.achievement_sections (section_key, title, title_en, source, source_en, position) values
  ('transafer', '원화 입출금 검증 시장 점유율 업계 1위', 'Industry-leading market share in KRW deposit and withdrawal verification', 'TranSafer, 2026. 10 기준', 'TranSafer, as of Oct 2026', 0),
  ('kyt', '데이터 수집부터 분석 기술까지 자체 구축한 소버린 KYT 솔루션', 'A sovereign KYT solution built in-house from data collection through analysis', 'TranSight, 2026.10 기준', 'TranSight, as of Oct 2026', 1),
  ('network', '국내 유일 수사기관-거래소 공조 네트워크로 응답 시간 단축', 'Faster response through Korea\'s only law-enforcement and exchange collaboration network', 'TranSight, 2026.10 기준', 'TranSight, as of Oct 2026', 2);

insert into public.achievement_metrics (
  section_id, metric_key, label, label_en, display_value, display_value_en, unit, unit_en, counter_target, position, show_on_home
)
select section.id, seed.metric_key, seed.label, seed.label_en, seed.display_value, seed.display_value_en, seed.unit, seed.unit_en, seed.counter_target, seed.position, seed.show_on_home
from public.achievement_sections section
join (values
  ('transafer', 'verified-transfers', '누적 입출금 검증 금액', 'Verified KRW Transfers', '1,026', '1,026', '조', 'Trillion', 1026, 0, true),
  ('transafer', 'flagged-transactions', '이상거래 탐지 건수', 'Flagged Transactions', '671', '671', '만', 'M', 671, 1, true),
  ('kyt', 'identified-addresses', '주소 식별 정보', 'Identified address data', '1', '100', '억+', 'M+', null, 0, false),
  ('kyt', 'kyt-screenings', 'KYT 검증 건수', 'KYT Screenings', '9', '9', '억+', 'M+', 9, 1, true),
  ('network', 'agency-response-time', '평균 공조 응답 시간', 'Average Response Time', '72', '72', '시간', 'hours', 72, 0, true),
  ('network', 'total-requests', '총 요청 건수', 'Total requests', '180', '180', '건', 'requests', null, 1, false)
) as seed(section_key, metric_key, label, label_en, display_value, display_value_en, unit, unit_en, counter_target, position, show_on_home)
  on seed.section_key = section.section_key;

alter table public.achievement_sections enable row level security;
alter table public.achievement_metrics enable row level security;

revoke all on public.achievement_sections, public.achievement_metrics from anon, authenticated;
grant select on public.achievement_sections, public.achievement_metrics to anon;
grant select, update on public.achievement_sections, public.achievement_metrics to authenticated;

create policy "public can read achievement sections"
  on public.achievement_sections for select to anon using (true);
create policy "public can read achievement metrics"
  on public.achievement_metrics for select to anon using (true);
create policy "authenticated can manage achievement sections"
  on public.achievement_sections for all to authenticated using (true) with check (true);
create policy "authenticated can manage achievement metrics"
  on public.achievement_metrics for all to authenticated using (true) with check (true);
