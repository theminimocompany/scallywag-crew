-- ============================================================================
-- Scallywag Crew — 001_schema.sql
-- Multi-tenant-ready schema for Supabase (Postgres 15+).
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Idempotent-ish: safe to run once on a fresh project. Do NOT run twice.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,           -- used in URLs: /t/scallywag/...
  name        text not null,                  -- team name, editable in Settings
  signup_open boolean not null default true,  -- master switch for the public form
  created_at  timestamptz not null default now()
);

create table public.tenant_members (          -- who may administer a tenant
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'admin' check (role in ('admin')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.crew (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  airtable_id             text,               -- migration traceability
  name                    text not null,
  given_name              text,
  family_name             text,
  phone                   text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  notes                   text,
  is_approved             boolean not null default false,  -- false = self-registered, pending admin approval (🆕 badge)
  created_at              timestamptz not null default now(),
  unique (tenant_id, airtable_id)
);

create table public.races (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  airtable_id  text,
  name         text not null,
  race_date    date not null,
  is_hidden    boolean not null default false, -- hidden from the public schedule
  signup_closed boolean not null default false, -- listed publicly but takes no new sign-ups
  created_at   timestamptz not null default now(),
  unique (tenant_id, airtable_id)
);

create table public.signups (                 -- one row per (crew, race)
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  crew_id     uuid not null references public.crew(id)  on delete cascade,
  race_id     uuid not null references public.races(id) on delete cascade,
  status      text not null default 'available' check (status in ('available','selected')),
  source      text not null default 'form'    check (source  in ('form','admin','migration')),
  created_at  timestamptz not null default now(),
  unique (crew_id, race_id)
);

create index crew_tenant_name_idx    on public.crew    (tenant_id, name);
create index races_tenant_date_idx   on public.races   (tenant_id, race_date);
create index signups_race_status_idx on public.signups (race_id, status);
create index signups_crew_idx        on public.signups (crew_id);
create index signups_tenant_idx      on public.signups (tenant_id);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
--    Default posture: everything locked. Public access happens ONLY through
--    the two security-definer views in section 4 + the two INSERT policies
--    below (the signup form). Admin access goes through tenant_members.
-- ---------------------------------------------------------------------------

alter table public.tenants        enable row level security;
alter table public.tenant_members enable row level security;
alter table public.crew           enable row level security;
alter table public.races          enable row level security;
alter table public.signups        enable row level security;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid()
  );
$$;

-- tenants: world-readable (slug + name only; needed to resolve /t/<slug>)
create policy tenants_public_read on public.tenants
  for select to anon, authenticated using (true);

-- admins may edit their tenant's name + signup_open (slug stays fixed:
-- the column-level GRANT below lists exactly what can change)
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (public.is_tenant_admin(id))
  with check (public.is_tenant_admin(id));

-- tenant_members: a member can see their own memberships; admins manage theirs
create policy members_self_read on public.tenant_members
  for select to authenticated using (user_id = auth.uid());
create policy members_admin_all on public.tenant_members
  for all to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- crew: admin full access; public self-registration via register_crew() below
create policy crew_admin_all on public.crew
  for all to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
-- Public self-registration goes through a SECURITY DEFINER function instead of
-- a direct INSERT policy: the app needs the new row's id back, and RETURNING
-- would require SELECT on crew, which anon must not have (contacts are private).
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

-- races: admin full access; no direct public access (public uses the view)
create policy races_admin_all on public.races
  for all to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- signups: admin full access; public can submit 'available' signups for
-- upcoming races of an existing tenant — nothing else.
create policy signups_admin_all on public.signups
  for all to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
-- The "race is open" test lives in a SECURITY DEFINER function because the
-- anon role has no SELECT on races; a plain subquery in the policy would run
-- as anon and fail with 42501.
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
create policy signups_public_insert on public.signups
  for insert to anon
  with check (
    status = 'available'
    and source = 'form'
    and public.race_open_for_signup(tenant_id, race_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Grants (RLS is row-level; these control which columns/operations each
--    role may touch at all)
-- ---------------------------------------------------------------------------

revoke all on public.tenants, public.tenant_members, public.crew,
              public.races, public.signups
from anon, authenticated;

grant select on public.tenants to anon, authenticated;
grant update (name, signup_open) on public.tenants to authenticated;

grant select on public.tenant_members to authenticated;

grant select, insert, update, delete on public.crew   to authenticated;
grant select, insert, update, delete on public.races  to authenticated;
grant select, insert, update, delete on public.signups to authenticated;

-- public signup form: signup rows + the register_crew RPC (only crew write path)
grant insert (tenant_id, crew_id, race_id)              on public.signups to anon;
grant execute on function public.register_crew(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public surface (security-definer views — deliberately bypass RLS to
--    expose exactly this and nothing more):
--    • public_crew_directory: approved crew names, for the form's name picker
--    • public_schedule: upcoming races + SELECTED crew names only.
--      Past races, available lists and all history stay admin-only.
-- ---------------------------------------------------------------------------

create or replace view public.public_crew_directory
with (security_invoker = false)
as
  select t.slug as tenant_slug, c.id as crew_id, c.name
  from public.crew c
  join public.tenants t on t.id = c.tenant_id
  where c.is_approved
  order by c.name;

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

grant select on public.public_crew_directory to anon, authenticated;
grant select on public.public_schedule       to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin management functions (Settings page)
-- ---------------------------------------------------------------------------

-- Add another admin by email. The login must already exist in Supabase Auth.
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

-- List current admins (emails) for the Settings page.
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

revoke all on function public.add_tenant_admin(uuid, text) from public;
grant execute on function public.add_tenant_admin(uuid, text) to authenticated;
revoke all on function public.list_tenant_admins(uuid) from public;
grant execute on function public.list_tenant_admins(uuid) to authenticated;

-- ============================================================================
-- Done. Next: run 002_seed.sql, then create your admin login
-- (Authentication → Users → Add user) and link it with:
--   insert into public.tenant_members (tenant_id, user_id)
--   select id, '<your-auth-user-uuid>' from public.tenants where slug='scallywag';
-- ============================================================================
