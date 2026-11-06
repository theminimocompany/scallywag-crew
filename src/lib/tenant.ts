import { useSyncExternalStore } from 'react'
import { TEAM_NAME, TENANT_SLUG } from './config'

// Runtime team name: loaded from the tenants table on boot (falls back to the
// build-time constant). Subscribers re-render the moment it changes, so an
// admin rename repaints every wordmark without a reload.
let name = TEAM_NAME
const listeners = new Set<() => void>()

export function setTeamName(next: string) {
  const trimmed = next.trim()
  if (!trimmed || trimmed === name) return
  name = trimmed
  listeners.forEach(l => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useTeamName(): string {
  return useSyncExternalStore(subscribe, () => name)
}

// ---------- runtime tenant slug ----------
// The URL decides which team is loaded (/t/<slug>/...). All data helpers read
// the slug through currentTenantSlug() instead of the build-time constant.
let slug = TENANT_SLUG

export function setTenantSlug(next: string) {
  if (next) slug = next
}

export function currentTenantSlug(): string {
  return slug
}
