import { useSyncExternalStore } from 'react'
import { TEAM_NAME } from './config'

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
