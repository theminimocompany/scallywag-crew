import { createPortal } from 'react-dom'
import { navigate, segments, useHash } from '@/lib/hash'
import { useTeamName, currentTenantSlug } from '@/lib/tenant'
import { ClButton, TeamBrand } from '@/components/CrewlistUI'

export function PublicHeader({ right }: { right?: React.ReactNode }) {
  const teamName = useTeamName()
  return (
    <header className="hairline-b bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
        <button
          className="wordmark cursor-pointer"
          onClick={() => navigate(`/t/${currentTenantSlug()}/schedule`)}
          aria-label={`${teamName} home`}
        >
          {teamName}
          <span style={{ marginLeft: 8, fontSize: 11, letterSpacing: '0.04em', fontWeight: 600, color: 'hsl(var(--royal))', textTransform: 'none' }}>
            by Crewlist
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            className="text-xs font-medium cursor-pointer"
            style={{ color: 'hsl(var(--slate))', minHeight: 44, padding: '0 8px' }}
            onClick={() => navigate(`/t/${currentTenantSlug()}/admin`)}
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
  const base = `/t/${currentTenantSlug()}`
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

export function AdminHeader({
  onSignOut,
  teamName: teamNameOverride,
  previewBase,
}: {
  onSignOut: () => void
  teamName?: string
  previewBase?: string
}) {
  const liveTeamName = useTeamName()
  const teamName = teamNameOverride ?? liveTeamName
  const hash = useHash()
  const current = segments(hash)
  const base = previewBase ?? `/t/${currentTenantSlug()}/admin`
  const items = [
    [`${base}/races`, 'Races', 'races'],
    [`${base}/roster`, 'Crew', 'roster'],
    [`${base}/import`, 'Import', 'import'],
    [`${base}/settings`, 'Settings', 'settings'],
  ] as const
  const routeSection = previewBase ? current[2] : current[3]
  const active = routeSection === 'race-detail' ? 'races' : routeSection
  return (
    <header className="cl-public-header cl-admin-header">
      <div className="cl-container cl-admin-header__inner">
        <button
          type="button"
          className="cl-public-brand cl-admin-brand"
          onClick={() => navigate(previewBase ? `${previewBase}/races/default` : `/t/${currentTenantSlug()}/schedule`)}
          aria-label={`${teamName} ${previewBase ? 'admin races' : 'public schedule'}`}
        >
          <TeamBrand teamName={teamName} />
        </button>
        <nav className="cl-admin-nav" aria-label="Admin">
          {items.map(([to, label, id]) => (
            <button
              type="button"
              key={to}
              className="cl-admin-nav__item"
              aria-current={active === id || (active === undefined && id === 'races') ? 'page' : undefined}
              onClick={() => navigate(previewBase ? `${to}/default` : to)}
            >
              {label}
            </button>
          ))}
        </nav>
        <ClButton variant="secondary" size="small" className="cl-admin-signout" onClick={onSignOut}>Sign out</ClButton>
      </div>
    </header>
  )
}

/**
 * Fixed bottom action bar. Always visible above the browser's own bottom UI:
 * safe-area inset + solid backdrop. Pair with generous bottom padding on the
 * page's <main> (pb-32) so content can scroll clear of it.
 */
export function FloatingBar({ children, wide, crewlist = false }: { children: React.ReactNode; wide?: boolean; crewlist?: boolean }) {
  // Portal to <body>: any ancestor with a transform/animation (e.g. fade-in)
  // becomes the containing block for position:fixed and would pin the bar to
  // the page bottom instead of the viewport.
  return createPortal(
    <div className={crewlist ? 'cl-admin-floating' : undefined} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, pointerEvents: 'none' }}>
      <div
        className={crewlist ? `cl-container ${wide ? 'cl-admin-floating__wide' : ''}` : wide ? 'page page-wide w-full' : 'page'}
        style={crewlist ? undefined : {
          paddingTop: 28,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          background: 'linear-gradient(to top, hsl(var(--ice)) 60%, hsl(var(--ice) / 0))',
        }}
      >
        <div className={crewlist ? 'cl-admin-floating__content' : 'space-y-2'} style={crewlist ? undefined : { pointerEvents: 'auto' }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
