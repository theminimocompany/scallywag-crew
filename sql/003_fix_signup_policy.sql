-- ============================================================================
-- Scallywag crew management — 003_fix_signup_policy.sql
-- Run AFTER 001_schema.sql and 002_seed.sql (idempotent — safe to re-run).
--
-- Symptom:  submitting the public sign-up form fails with
--             42501 "permission denied for table races"
-- Cause:    the signups_public_insert policy checks the race with a subquery
--           on public.races. Policy expressions run as the calling user, and
--           the anonymous role has no SELECT on races (by design — the public
--           only sees races through the public_schedule view), so the check
--           errors out instead of passing.
-- Fix:      move the "race is open for sign-up" test into a SECURITY DEFINER
--           function (runs as the database owner, which can read races), then
--           recreate the policy to use it. DDL only — no data is touched.
-- ============================================================================

create or replace function public.race_open_for_signup(p_tenant_id uuid, p_race_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.races r
    where r.id = p_race_id
      and r.tenant_id = p_tenant_id
      and r.race_date >= current_date
  );
$$;

comment on function public.race_open_for_signup(uuid, uuid) is
  'True when the race belongs to the tenant and is today or later. Security definer so the anon sign-up policy can validate races without direct table access.';

drop policy if exists signups_public_insert on public.signups;

create policy signups_public_insert on public.signups
  for insert to anon
  with check (
    status = 'available'
    and source = 'form'
    and public.race_open_for_signup(tenant_id, race_id)
  );

-- ----------------------------------------------------------------------------
-- Verification — expect:
--   1) one row:  race_open_for_signup | t
--   2) one row:  signups_public_insert | INSERT
-- ----------------------------------------------------------------------------
select proname, prosecdef from pg_proc where proname = 'race_open_for_signup';
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'signups' and policyname = 'signups_public_insert';
