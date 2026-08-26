-- PostgREST cannot resolve overloaded RPCs when a request only contains the
-- parameter names shared by both signatures. Keep the legacy public RPC name
-- and give the admin/date-filter contract its own unambiguous name.

alter function public.list_resources(
  integer,
  integer,
  text,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz
) rename to list_admin_resources;

revoke all on function public.list_admin_resources(
  integer,
  integer,
  text,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz
) from public;

grant execute on function public.list_admin_resources(
  integer,
  integer,
  text,
  text,
  text,
  boolean,
  timestamptz,
  timestamptz
) to anon, authenticated;

notify pgrst, 'reload schema';
