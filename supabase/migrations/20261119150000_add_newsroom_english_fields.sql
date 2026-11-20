alter table public.posts add column if not exists title_en text null check (title_en is null or char_length(btrim(title_en)) <= 200);
alter table public.posts add column if not exists content_en text null;
