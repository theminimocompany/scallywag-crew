import { navigate } from '@/lib/hash'

/** Console-only header: Crewlist wordmark, super-admin identity, sign out. */
export function ConsoleChrome({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <header className="hairline-b bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="page page-wide flex items-center justify-between gap-3" style={{ minHeight: 56 }}>
        <button
          className="wordmark cursor-pointer"
          style={{ textTransform: 'none', letterSpacing: '-0.01em' }}
          onClick={() => navigate('/console')}
          aria-label="Crewlist console home"
        >
          Crewlist.
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium hidden sm:inline" style={{ color: 'hsl(var(--royal))' }}>
            Super admin · {email}
          </span>
          <button className="chip cursor-pointer" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </header>
  )
}

export function StatusChip({ status }: { status: 'active' | 'suspended' | 'past_due' }) {
  const map = {
    active: { label: 'Active', color: '#166534', bg: '#dcfce7' },
    suspended: { label: 'Suspended', color: '#b91c1c', bg: '#fee2e2' },
    past_due: { label: 'Past due', color: '#92400e', bg: '#fef3c7' },
  } as const
  const s = map[status] ?? map.active
  return (
    <span className="inline-block text-xs font-semibold" style={{ color: s.color, background: s.bg, borderRadius: 999, padding: '3px 10px' }}>
      {s.label}
    </span>
  )
}
