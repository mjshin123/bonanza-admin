create table public.awards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organization text not null,
  awarded_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint awards_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint awards_organization_check check (char_length(btrim(organization)) between 1 and 160)
);

create index awards_public_date_idx on public.awards (awarded_on desc, created_at desc);
create trigger awards_set_updated_at before update on public.awards for each row execute function public.set_updated_at();

alter table public.awards enable row level security;
revoke all on public.awards from anon, authenticated;
grant select on public.awards to anon;
grant select, insert, update, delete on public.awards to authenticated;
create policy "public can read awards" on public.awards for select to anon using (true);
create policy "authenticated can manage awards" on public.awards for all to authenticated using (true) with check (true);

create or replace function public.save_award(
  p_title text, p_organization text, p_awarded_on date,
  p_id uuid default null, p_expected_updated_at timestamptz default null
) returns public.awards language plpgsql security invoker set search_path = '' as $$
declare saved public.awards;
begin
  if auth.role() <> 'authenticated' then raise insufficient_privilege using message = 'authentication required'; end if;
  if char_length(btrim(p_title)) not between 1 and 160 or char_length(btrim(p_organization)) not between 1 and 160 then raise invalid_parameter_value using message = 'invalid award'; end if;
  if p_id is null then
    insert into public.awards (title, organization, awarded_on) values (btrim(p_title), btrim(p_organization), p_awarded_on) returning * into saved;
    return saved;
  end if;
  if p_expected_updated_at is null then raise invalid_parameter_value using message = 'expected_updated_at is required'; end if;
  select * into saved from public.awards where id = p_id for update;
  if not found then raise no_data_found using message = 'award not found'; end if;
  if saved.updated_at <> p_expected_updated_at then raise serialization_failure using message = 'award changed'; end if;
  update public.awards set title = btrim(p_title), organization = btrim(p_organization), awarded_on = p_awarded_on where id = p_id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_award(text, text, date, uuid, timestamptz) from public, anon;
grant execute on function public.save_award(text, text, date, uuid, timestamptz) to authenticated;

insert into public.awards (title, organization, awarded_on) values
  ('벤처창업진흥 유공 중기부 장관상 수상', '중소벤처기업부', '2024-12-01'),
  ('아기유니콘 육성사업 수익성장형 트랙 기업 선정', '중소벤처기업부', '2025-09-01'),
  ('국제표준인증 획득 ISO9001·14001', 'EURO CERT', '2024-11-01'),
  ('ISMS 인증 획득 통합입출금 서비스 외', '한국인터넷진흥원', '2024-01-01'),
  ('기술혁신형 중소기업 인증 획득 AA등급', '중소벤처기업부', '2022-05-01'),
  ('서울핀테크랩 매출부문 최우수상 수상', '서울핀테크랩', '2021-12-01'),
  ('혁신성장형 벤처기업 인증 획득', '과학기술정보통신부', '2021-10-01'),
  ('형사발전 기여 감사장 수상', '경찰청', '2021-10-01'),
  ('규제샌드박스 위탁테스트 기업 선정', '금융위원회', '2019-08-01');
