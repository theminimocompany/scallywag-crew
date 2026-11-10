-- A holder of a valid invitation token may read only its fixed email address.
-- The token remains required, and accept_invite still enforces the same match.
create or replace function public.get_invite_email(p_token uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.email
  from public.tenant_invites as i
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

revoke execute on function public.get_invite_email(uuid) from public;
grant execute on function public.get_invite_email(uuid) to anon, authenticated;
