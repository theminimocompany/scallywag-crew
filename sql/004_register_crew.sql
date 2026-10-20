-- ============================================================================
-- Scallywag crew management — 004_register_crew.sql
-- Run AFTER 003_fix_signup_policy.sql (idempotent — safe to re-run).
--
-- Symptom:  a NEW crew member ("I'm new to the team") submitting the form
--           fails with  42501 "permission denied for table crew".
-- Cause:    the app asks for the new row's id back (RETURNING), and reading
--           anything from the crew table needs SELECT — which the anonymous
--           role deliberately does not have (crew contacts stay private).
-- Fix:      a SECURITY DEFINER function that inserts the quarantined crew row
--           (is_approved = false, hardcoded) and returns the id, callable by
--           the public role. The direct INSERT grant on crew is then revoked —
--           this function becomes the only public write path to crew.
--           DDL only — no data is touched.
-- ============================================================================

create or replace function public.register_crew(p_tenant_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := trim(p_name);
begin
  if char_length(v_name) < 2 then
    raise exception 'crew name too short';
  end if;
  insert into public.crew (tenant_id, name, is_approved)
  values (p_tenant_id, v_name, false)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.register_crew(uuid, text) is
  'Public self-registration: creates a quarantined (is_approved = false) crew row and returns its id. Security definer so anon needs no direct privileges on crew.';

grant execute on function public.register_crew(uuid, text) to anon, authenticated;

-- Tighten: the function above is now the only public write path to crew.
revoke insert on public.crew from anon;
drop policy if exists crew_public_register on public.crew;

-- ----------------------------------------------------------------------------
-- Verification — expect:
--   1) one row:  register_crew | t
--   2) zero rows (no crew_public_register policy remains)
-- ----------------------------------------------------------------------------
select proname, prosecdef from pg_proc where proname = 'register_crew';
select policyname from pg_policies
where schemaname = 'public' and tablename = 'crew' and policyname = 'crew_public_register';
