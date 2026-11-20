create table if not exists public.privacy_policies (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null unique,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_policies_effective_date_idx
  on public.privacy_policies (effective_date desc);

alter table public.privacy_policies enable row level security;

create policy "public can read privacy policies"
  on public.privacy_policies for select using (true);

create policy "authenticated users manage privacy policies"
  on public.privacy_policies for all to authenticated using (true) with check (true);

create trigger privacy_policies_set_updated_at
  before update on public.privacy_policies
  for each row execute function public.set_updated_at();

grant select on public.privacy_policies to anon, authenticated;
grant insert, update, delete on public.privacy_policies to authenticated;
