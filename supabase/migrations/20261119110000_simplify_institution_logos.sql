-- Institutions now manage the two home-page logo rows directly.
-- Existing member rows remain on the financial-institution row and partner
-- rows remain on the public-organization/other row.

drop policy if exists "public can read active institution categories"
  on public.institution_categories;
drop policy if exists "authenticated can manage institution_categories"
  on public.institution_categories;
drop policy if exists "public can read active institutions" on public.institutions;
drop policy if exists "public can read referenced files" on public.files;
drop policy if exists "public can read published posts" on public.posts;

alter table public.institutions
  drop constraint if exists institutions_category_type_fkey,
  drop constraint if exists institutions_category_id_fkey;

alter table public.institutions
  drop column category_id,
  drop column description,
  drop column homepage_url,
  drop column is_pending;

drop function if exists public.swap_institution_category_order(uuid, uuid);
drop table public.institution_categories;

drop index if exists public.institutions_category_idx;
drop index if exists public.institutions_public_list_idx;
create index institutions_public_list_idx
  on public.institutions (institution_type, display_order, name, id)
  where is_active = true;

revoke select on public.institutions from anon;
grant select (id, institution_type, name, logo_file_id, display_order,
  is_active, created_at, updated_at) on public.institutions to anon;

create policy "public can read active institutions"
on public.institutions for select to anon using (is_active = true);

create policy "public can read referenced files"
on public.files for select to anon using (
  exists (
    select 1 from public.institutions i
    where i.logo_file_id = files.id and i.is_active
  )
  or exists (select 1 from public.post_files pf join public.posts p on p.id = pf.post_id
    where pf.file_id = files.id and p.status = 'published' and p.published_at <= now())
  or exists (select 1 from public.resource_files rf join public.resources r on r.id = rf.resource_id
    where rf.file_id = files.id and r.status = 'published' and r.published_at <= now())
  or exists (select 1 from public.seminar_files sf join public.seminars s on s.id = sf.seminar_id
    where sf.file_id = files.id and s.status = 'published' and s.published_at <= now())
  or exists (select 1 from public.gallery_items gi join public.galleries g on g.id = gi.gallery_id
    where gi.file_id = files.id and g.status = 'published' and g.published_at <= now())
);

create policy "public can read published posts"
on public.posts for select to anon using (
  (
    category is not null and status = 'published' and published_at <= now()
    and (
      category <> 'member_news'
      or exists (select 1 from public.institutions i
        where i.id = institution_id and i.is_active and i.institution_type = 'member')
    )
  )
  or (
    category is null and is_published = true
    and exists (select 1 from public.boards b where b.id = board_id and b.is_active)
  )
);
