-- Run in the Eduplanner Supabase SQL editor after reviewing the backup.
-- Adds a restrictive active-account guard to business tables. Existing policies stay in place.
begin;
do $guard$
declare item text;
begin
  if to_regprocedure('public.current_profile_status()') is null then
    raise exception 'The existing Eduplanner profile-status function must be present';
  end if;
  foreach item in array array['lesson_plans','app_messages','curriculum_items'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=item and c.relrowsecurity) then
      raise exception 'Expected RLS-enabled Eduplanner business table is missing: %',item;
    end if;
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=item and policyname='kcs_orbit_active_account_guard') then
      execute format('create policy kcs_orbit_active_account_guard on public.%I as restrictive for all to authenticated using (public.current_profile_status() = ''active'') with check (public.current_profile_status() = ''active'')',item);
    end if;
  end loop;
end;
$guard$;
create or replace function public.kcs_orbit_access_policy_ready()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $ready$
  select count(*)=3 from pg_policies where schemaname='public' and tablename in ('lesson_plans','app_messages','curriculum_items') and policyname='kcs_orbit_active_account_guard' and permissive='RESTRICTIVE';
$ready$;
revoke all on function public.kcs_orbit_access_policy_ready() from public,anon,authenticated;
grant execute on function public.kcs_orbit_access_policy_ready() to service_role;
commit;
select public.kcs_orbit_access_policy_ready() as access_policy_ready;
