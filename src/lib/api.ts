import { supabase } from './supabase'
import { TENANT_SLUG } from './config'

// ---------- types ----------
export interface Tenant { id: string; slug: string; name: string; signup_open?: boolean }
export interface DirectoryEntry { tenant_slug: string; crew_id: string; name: string }
export interface ScheduleRow {
  tenant_slug: string; race_id: string; race_name: string
  race_date: string; selected_crew: string[]; signup_closed?: boolean
}
export interface Crew {
  id: string; tenant_id: string; airtable_id: string | null
  name: string; given_name: string | null; family_name: string | null
  phone: string | null; emergency_contact_name: string | null
  emergency_contact_phone: string | null; notes: string | null
  is_approved: boolean; created_at: string
}
export interface Race { id: string; tenant_id: string; name: string; race_date: string; is_hidden?: boolean; signup_closed?: boolean }
export type SignupStatus = 'available' | 'selected'
export interface Signup {
  id: string; tenant_id: string; crew_id: string; race_id: string
  status: SignupStatus; source: 'form' | 'admin' | 'migration'; created_at: string
}

let tenantCache: Tenant | null = null
export async function getTenant(): Promise<Tenant> {
  if (tenantCache) return tenantCache
  // select('*'): stays valid whether or not the settings migration (005)
  // has been applied yet — signup_open is simply absent before it.
  const { data, error } = await supabase
    .from('tenants').select('*').eq('slug', TENANT_SLUG).single()
  if (error) throw error
  tenantCache = data as Tenant
  return tenantCache
}

export function clearTenantCache() {
  tenantCache = null
}

// ---------- public surface ----------
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase
    .from('public_crew_directory').select('*').eq('tenant_slug', TENANT_SLUG)
  if (error) throw error
  return data as DirectoryEntry[]
}

export async function fetchSchedule(): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('public_schedule').select('*').eq('tenant_slug', TENANT_SLUG)
  if (error) throw error
  return data as ScheduleRow[]
}

export async function submitSignups(crewId: string, raceIds: string[]): Promise<void> {
  const t = await getTenant()
  // Plain per-row inserts, not an upsert: upsert (ON CONFLICT) requires SELECT
  // on the table to inspect existing rows, which the anon role deliberately
  // lacks. Duplicate submissions surface as unique-violation 23505 — that is
  // the idempotency signal, so it is treated as success.
  const results = await Promise.all(
    raceIds.map(race_id =>
      supabase.from('signups').insert({ tenant_id: t.id, crew_id: crewId, race_id }),
    ),
  )
  const failure = results
    .map(r => r.error)
    .find(e => e && e.code !== '23505')
  if (failure) throw failure
}

export async function registerCrew(name: string): Promise<string> {
  const t = await getTenant()
  // Security-definer RPC: the new row's id comes back without needing SELECT
  // on crew (anon has none — crew contacts stay private).
  const { data, error } = await supabase.rpc('register_crew', { p_tenant_id: t.id, p_name: name.trim() })
  if (error) throw error
  return data as string
}

// ---------- admin ----------
export async function fetchRaces(): Promise<Race[]> {
  const { data, error } = await supabase
    .from('races').select('*').order('race_date')
  if (error) throw error
  return data as Race[]
}

export async function fetchAllSignups(): Promise<Signup[]> {
  // small dataset (~650 rows) — aggregate client-side
  const { data, error } = await supabase
    .from('signups').select('id,tenant_id,crew_id,race_id,status,source,created_at')
  if (error) throw error
  return data as Signup[]
}

export async function fetchRaceSignups(raceId: string): Promise<(Signup & { crew: Pick<Crew, 'id' | 'name' | 'is_approved'> })[]> {
  const { data, error } = await supabase
    .from('signups')
    .select('id,tenant_id,crew_id,race_id,status,source,created_at,crew:crew_id(id,name,is_approved)')
    .eq('race_id', raceId)
    .order('created_at')
  if (error) throw error
  return data as never[]
}

export async function setSignupStatus(signupId: string, status: SignupStatus): Promise<void> {
  const { error } = await supabase.from('signups').update({ status }).eq('id', signupId)
  if (error) throw error
}

export async function removeSignup(signupId: string): Promise<void> {
  const { error } = await supabase.from('signups').delete().eq('id', signupId)
  if (error) throw error
}

export async function addToSelected(raceId: string, crewId: string): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.from('signups').upsert(
    { tenant_id: t.id, crew_id: crewId, race_id: raceId, status: 'selected', source: 'admin' },
    { onConflict: 'crew_id,race_id' }
  )
  if (error) throw error
}

export async function fetchCrewAll(): Promise<Crew[]> {
  const { data, error } = await supabase.from('crew').select('*').order('name')
  if (error) throw error
  return data as Crew[]
}

export async function fetchCrewHistory(crewId: string): Promise<(Signup & { races: Pick<Race, 'id' | 'name' | 'race_date'> })[]> {
  const { data, error } = await supabase
    .from('signups')
    .select('id,tenant_id,crew_id,race_id,status,source,created_at,races:race_id(id,name,race_date)')
    .eq('crew_id', crewId)
  if (error) throw error
  return data as never[]
}

export async function approveCrew(crewId: string): Promise<void> {
  const { error } = await supabase.from('crew').update({ is_approved: true }).eq('id', crewId)
  if (error) throw error
}

export async function updateCrew(id: string, patch: Partial<Crew>): Promise<void> {
  const { error } = await supabase.from('crew').update(patch).eq('id', id)
  if (error) throw error
}

export async function addCrew(fields: { name: string; phone?: string; emergency_contact_name?: string; emergency_contact_phone?: string }): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.from('crew').insert({ tenant_id: t.id, is_approved: true, ...fields })
  if (error) throw error
}

export async function deleteCrew(crewId: string): Promise<void> {
  // signups.crew_id is ON DELETE CASCADE — the person's signups go with them
  const { error } = await supabase.from('crew').delete().eq('id', crewId)
  if (error) throw error
}

export async function addRace(name: string, raceDate: string): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.from('races').insert({ tenant_id: t.id, name, race_date: raceDate })
  if (error) throw error
}

export async function deleteRace(raceId: string): Promise<void> {
  const { error } = await supabase.from('races').delete().eq('id', raceId)
  if (error) throw error
}

// ---------- settings (admin) ----------
export async function updateTeamName(name: string): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.from('tenants').update({ name: name.trim() }).eq('id', t.id)
  if (error) throw error
  clearTenantCache()
}

export async function setSignupOpen(open: boolean): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.from('tenants').update({ signup_open: open }).eq('id', t.id)
  if (error) throw error
  clearTenantCache()
}

export async function setRaceHidden(raceId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('races').update({ is_hidden: hidden }).eq('id', raceId)
  if (error) throw error
}

export async function setRaceSignupClosed(raceId: string, closed: boolean): Promise<void> {
  const { error } = await supabase.from('races').update({ signup_closed: closed }).eq('id', raceId)
  if (error) throw error
}

export interface AdminInfo { email: string; is_you: boolean }

export async function listAdmins(): Promise<AdminInfo[]> {
  const t = await getTenant()
  const { data, error } = await supabase.rpc('list_tenant_admins', { p_tenant_id: t.id })
  if (error) throw error
  return data as AdminInfo[]
}

export async function addAdminByEmail(email: string): Promise<void> {
  const t = await getTenant()
  const { error } = await supabase.rpc('add_tenant_admin', { p_tenant_id: t.id, p_email: email.trim() })
  if (error) throw error
}

// ---------- RHKYC calendar CSV ----------
// Columns (Google Calendar export): Subject, Start Date (DD/MM/YYYY),
// Start Time, End Date, End Time, All Day Event, Description, Location, Private
export interface CsvRace { name: string; date: string; location: string; duplicate: boolean; include: boolean }

export function parseRhkycCsv(text: string, existing: Race[]): CsvRace[] {
  const rows = csvParse(text)
  if (rows.length < 2) return []
  const head = rows[0].map(h => h.trim().toLowerCase())
  const iSub = head.indexOf('subject')
  const iDate = head.indexOf('start date')
  const iLoc = head.indexOf('location')
  if (iSub < 0 || iDate < 0) throw new Error('Missing "Subject" / "Start Date" columns — is this the RHKYC calendar export?')
  const key = (n: string, d: string) => `${d}|${n.trim().toLowerCase()}`
  const have = new Set(existing.map(r => key(r.name, r.race_date)))
  const out: CsvRace[] = []
  for (const r of rows.slice(1)) {
    const name = (r[iSub] || '').trim()
    const dmy = (r[iDate] || '').trim()
    if (!name || !dmy) continue
    const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) continue
    const date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const isDuty = /race management/i.test(name)
    out.push({
      name, date, location: (r[iLoc] || '').trim(),
      duplicate: have.has(key(name, date)),
      include: !isDuty && !have.has(key(name, date)),
    })
  }
  return out
}

function csvParse(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

// ---------- formatting ----------
export function fmtDate(iso: string): { day: string; dow: string; mon: string } {
  const d = new Date(iso + 'T00:00:00')
  return {
    day: String(d.getDate()),
    dow: d.toLocaleDateString('en-HK', { weekday: 'short' }),
    mon: d.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' }),
  }
}

export function groupByMonth<T extends { race_date: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = r.race_date.slice(0, 7)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()].map(([k, v]) => {
    const d = new Date(k + '-01T00:00:00')
    return [d.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' }), v] as [string, T[]]
  })
}
