-- ============================================================================
-- 005_settings.sql — Admin settings: team name, sign-ups toggle,
--                    race visibility, additional admins.
-- Run once in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- 1) New columns ----------------------------------------------------------
alter table public.tenants
  add column if not exists signup_open boolean not null default true;

alter table public.races
  add column if not exists is_hidden boolean not null default false;

-- 2) Admins may edit their own tenant's name + signup_open ----------------
--    (slug stays immutable: column-level grant, not table-level)
drop policy if exists tenants_admin_update on public.tenants;
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (public.is_tenant_admin(id))
  with check (public.is_tenant_admin(id));

grant update (name, signup_open) on public.tenants to authenticated;

-- 3) The signup gate now also respects tenants.signup_open ----------------
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
  );
$$;

-- 4) register_crew is also blocked while sign-ups are closed --------------
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
  if not (select signup_open from public.tenants where id = p_tenant_id) then
    raise exception 'Sign-ups are closed';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'crew name too short';
  end if;
  insert into public.crew (tenant_id, name, is_approved)
  values (p_tenant_id, v_name, false)
  returning id into v_id;
  return v_id;
end;
$$;

-- 5) Hidden races disappear from the public schedule ----------------------
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
         )           as selected_crew
  from public.races r
  join public.tenants t on t.id = r.tenant_id
  left join public.signups s
         on s.race_id = r.id and s.status = 'selected'
  left join public.crew c
         on c.id = s.crew_id and c.is_approved
  where r.race_date >= current_date
    and not r.is_hidden
  group by t.slug, r.id, r.name, r.race_date
  order by r.race_date;

-- 6) Add another admin by email -------------------------------------------
--    The login must already exist (Supabase → Authentication → Users →
--    Add user). Only a current admin of this tenant may add more.
create or replace function public.add_tenant_admin(p_tenant_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_tenant_admin(p_tenant_id) then
    raise exception 'Only an existing admin can add admins';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'No login found for that email. Create it first in Supabase: Authentication → Users → Add user.';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  values (p_tenant_id, v_uid, 'admin')
  on conflict (tenant_id, user_id) do nothing;
end;
$$;

revoke all on function public.add_tenant_admin(uuid, text) from public;
grant execute on function public.add_tenant_admin(uuid, text) to authenticated;

-- 7) List current admins (for the settings page) --------------------------
create or replace function public.list_tenant_admins(p_tenant_id uuid)
returns table (email text, is_you boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text as email,
         (u.id = auth.uid()) as is_you
  from public.tenant_members m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant_id
    and public.is_tenant_admin(p_tenant_id)
  order by u.email;
$$;

revoke all on function public.list_tenant_admins(uuid) from public;
grant execute on function public.list_tenant_admins(uuid) to authenticated;

-- ============================================================================
-- Verification — expected output after running:
--   tenants:  signup_open | boolean | true
--   races:    is_hidden   | boolean | false
--   policies: tenants_admin_update | UPDATE   (plus the existing SELECT)
--   functions listed: add_tenant_admin, list_tenant_admins,
--                     race_open_for_signup, register_crew
-- ============================================================================
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tenants' and column_name = 'signup_open';

select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'races' and column_name = 'is_hidden';

select policyname, cmd from pg_policies where tablename = 'tenants';

select proname from pg_proc
where proname in ('add_tenant_admin', 'list_tenant_admins',
                  'race_open_for_signup', 'register_crew')
order by proname;
