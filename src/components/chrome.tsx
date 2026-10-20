import { createPortal } from 'react-dom'
import { TENANT_SLUG } from '@/lib/config'
import { navigate } from '@/lib/hash'
import { useTeamName } from '@/lib/tenant'

export function PublicHeader({ right }: { right?: React.ReactNode }) {
  const teamName = useTeamName()
  return (
    <header className="hairline-b bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
        <button
          className="wordmark cursor-pointer"
          onClick={() => navigate(`/t/${TENANT_SLUG}/schedule`)}
          aria-label={`${teamName} home`}
        >
          {teamName}
        </button>
        <div className="flex items-center gap-2">
          <button
            className="text-xs font-medium cursor-pointer"
            style={{ color: 'hsl(var(--slate))', minHeight: 44, padding: '0 8px' }}
            onClick={() => navigate(`/t/${TENANT_SLUG}/admin`)}
          >
            Admin
          </button>
          {right}
        </div>
      </div>
    </header>
  )
}

export function PublicTabs({ active }: { active: 'schedule' | 'signup' }) {
  const base = `/t/${TENANT_SLUG}`
  return (
    <nav className="flex gap-1 p-1 panel" role="tablist" aria-label="Public pages">
      {(['schedule', 'signup'] as const).map(k => (
        <button
          key={k}
          role="tab"
          aria-selected={active === k}
          className={`chip cursor-pointer ${active === k ? 'chip-on' : ''}`}
          onClick={() => navigate(`${base}/${k}`)}
        >
          <span className="dot" aria-hidden />
          {k === 'schedule' ? 'Race schedule' : 'Sign up'}
        </button>
      ))}
    </nav>
  )
}

export function AdminHeader({ onSignOut }: { onSignOut: () => void }) {
  const teamName = useTeamName()
  const base = `/t/${TENANT_SLUG}/admin`
  const items = [
    [`${base}/races`, 'Races'],
    [`${base}/roster`, 'Crew'],
    [`${base}/import`, 'Import'],
    [`${base}/settings`, 'Settings'],
  ] as const
  return (
    <header className="hairline-b bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="page page-wide flex items-center justify-between gap-x-3 gap-y-1 flex-wrap py-2" style={{ minHeight: 56 }}>
        <span className="wordmark">{teamName}</span>
        <nav className="flex items-center gap-1 flex-wrap" aria-label="Admin">
          {items.map(([to, label]) => (
            <button
              key={to}
              className="chip cursor-pointer"
              onClick={() => navigate(to)}
            >
              {label}
            </button>
          ))}
          <button className="chip cursor-pointer" onClick={onSignOut}>Sign out</button>
        </nav>
      </div>
    </header>
  )
}

/**
 * Fixed bottom action bar. Always visible above the browser's own bottom UI:
 * safe-area inset + solid backdrop. Pair with generous bottom padding on the
 * page's <main> (pb-32) so content can scroll clear of it.
 */
export function FloatingBar({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  // Portal to <body>: any ancestor with a transform/animation (e.g. fade-in)
  // becomes the containing block for position:fixed and would pin the bar to
  // the page bottom instead of the viewport.
  return createPortal(
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, pointerEvents: 'none' }}>
      <div
        className={wide ? 'page page-wide w-full' : 'page'}
        style={{
          paddingTop: 28,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          background: 'linear-gradient(to top, hsl(var(--ice)) 60%, hsl(var(--ice) / 0))',
        }}
      >
        <div className="space-y-2" style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
