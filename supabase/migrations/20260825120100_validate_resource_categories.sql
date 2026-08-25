-- Validate after the data migration transaction has committed so deferred trigger
-- events cannot block the table validation lock.
alter table public.resources
  validate constraint resources_category_check;
