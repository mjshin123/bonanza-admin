-- =========================================================
-- KFCPA PUBLIC STORAGE BUCKET
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'public-assets',
  'public-assets',
  true
)
on conflict (id)
do update set
  name = excluded.name,
  public = excluded.public;
