import { supabase } from './supabase'

// ---------- Crewlist console (super admin) ----------
// Reads rely on the phase-0 super-admin RLS policies. All writes go through
// security-definer RPCs guarded by is_super_admin() — no broad table-write
// policies are granted for the console.

export type TenantStatus = 'active' | 'suspended' | 'past_due'
export type BillingPlan = 'free' | 'owner' | 'paid'

export interface ConsoleTeam {
  id: string
  slug: string
  name: string
  status: TenantStatus
  created_at: string
  tenant_billing: { plan: BillingPlan; paid_until: string | null; created_by_email: string | null } | null
  tenant_members: { count: number }[]
}

export async function isSuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_super_admin')
  if (error) return false
  return !!data
}

export async function fetchConsoleTeams(): Promise<ConsoleTeam[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id,slug,name,status,created_at,tenant_billing(plan,paid_until,created_by_email),tenant_members(count)')
    .order('created_at')
  if (error) throw error
  return data as unknown as ConsoleTeam[]
}

/** Row counts per tenant, aggregated server-side (GROUP BY tenant_id). */
export async function fetchCounts(table: 'crew' | 'races' | 'signups'): Promise<Record<string, number>> {
  const { data, error } = await supabase.from(table).select('tenant_id, n:count()')
  if (error) throw error
  const out: Record<string, number> = {}
  for (const row of data as unknown as { tenant_id: string; n: number }[]) out[row.tenant_id] = row.n
  return out
}

export interface ConsoleAdmin { user_id: string; email: string }

export async function superListAdmins(tenantId: string): Promise<ConsoleAdmin[]> {
  const { data, error } = await supabase.rpc('super_list_tenant_admins', { p_tenant_id: tenantId })
  if (error) throw error
  return data as ConsoleAdmin[]
}

export async function superSetStatus(tenantId: string, status: TenantStatus): Promise<void> {
  const { error } = await supabase.rpc('super_set_tenant_status', { p_tenant_id: tenantId, p_status: status })
  if (error) throw error
}

export async function superSetBilling(tenantId: string, plan: BillingPlan, paidUntil: string | null): Promise<void> {
  const { error } = await supabase.rpc('super_set_tenant_billing', {
    p_tenant_id: tenantId, p_plan: plan, p_paid_until: paidUntil,
  })
  if (error) throw error
}

export async function superAddSelfAdmin(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('super_add_self_admin', { p_tenant_id: tenantId })
  if (error) throw error
}

// ---------- display helpers ----------
export function billingLabel(t: ConsoleTeam): { text: string; tone: 'owner' | 'ok' | 'warn' | 'muted' } {
  const b = t.tenant_billing
  if (b?.plan === 'owner') return { text: 'Owner team', tone: 'owner' }
  if (b?.paid_until) {
    const today = new Date().toISOString().slice(0, 10)
    if (b.paid_until < today) {
      const graceEnd = new Date(b.paid_until + 'T00:00:00')
      graceEnd.setDate(graceEnd.getDate() + 14)
      const days = Math.ceil((graceEnd.getTime() - Date.now()) / 86400000)
      return days > 0
        ? { text: `Grace · ${days} days left`, tone: 'warn' }
        : { text: 'Payment overdue', tone: 'warn' }
    }
    return { text: `Paid to ${b.paid_until}`, tone: 'ok' }
  }
  return { text: 'Free · never billed', tone: 'muted' }
}
