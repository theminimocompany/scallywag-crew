-- ============================================================================
-- 006_race_signup_toggle.sql — per-race sign-up open/closed.
-- Run once in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- 1) New column: closed races refuse public sign-ups -----------------------
alter table public.races
  add column if not exists signup_closed boolean not null default false;

-- 2) The signup gate respects the per-race flag too ------------------------
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
    join public.tenants t on t.id = r.tenant_id
    where r.id = p_race_id
      and r.tenant_id = p_tenant_id
      and r.race_date >= current_date
      and t.signup_open
      and not r.signup_closed
  );
$$;

-- 3) Public schedule exposes the flag so the form can show "Closed" --------
--    (new column appended at the end — that's what allows CREATE OR REPLACE)
create or replace view public.public_schedule
with (security_invoker = false)
as
  select t.slug      as tenant_slug,
         r.id        as race_id,
         r.name      as race_name,
         r.race_date,
         coalesce(
           array_agg(c.name order by c.name)
             filter (where s.id is not null),
           '{}'
         )           as selected_crew,
         r.signup_closed
  from public.races r
  join public.tenants t on t.id = r.tenant_id
  left join public.signups s
         on s.race_id = r.id and s.status = 'selected'
  left join public.crew c
         on c.id = s.crew_id and c.is_approved
  where r.race_date >= current_date
    and not r.is_hidden
  group by t.slug, r.id, r.name, r.race_date, r.signup_closed
  order by r.race_date;

-- ============================================================================
-- Verification — expected output:
--   races:  signup_closed | boolean | false
--   view:   public_schedule now has a signup_closed column (last one)
-- ============================================================================
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'races' and column_name = 'signup_closed';

select column_name, ordinal_position
from information_schema.columns
where table_schema = 'public' and table_name = 'public_schedule'
order by ordinal_position;
