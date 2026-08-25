-- Admin-controlled flag to show an "[예정]" (upcoming) tag next to an
-- institution's name. Purely a display flag; it does not affect is_active
-- or any public visibility rule.
alter table public.institutions
  add column is_upcoming boolean not null default false;

grant select (is_upcoming) on public.institutions to anon;
