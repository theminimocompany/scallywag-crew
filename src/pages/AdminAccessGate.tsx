import { useEffect, useState } from 'react'
import { checkAdminAccess, errorText } from '@/lib/api'
import { navigate } from '@/lib/hash'
import { currentTenantSlug, useTeamName } from '@/lib/tenant'
import { ErrorBox, Spinner } from '@/components/bits'

type AccessState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'denied' }
  | { status: 'error'; message: string }

interface Props {
  tenantId: string
  userId: string
  onSignOut: () => Promise<void>
  children: React.ReactNode
}

/** Do not mount the admin header or pages until this team's access is proven. */
export default function AdminAccessGate({ tenantId, userId, onSignOut, children }: Props) {
  const teamName = useTeamName()
  const [state, setState] = useState<AccessState>({ status: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    checkAdminAccess(tenantId, userId)
      .then(allowed => {
        if (!cancelled) setState({ status: allowed ? 'allowed' : 'denied' })
      })
      .catch(e => {
        if (!cancelled) setState({ status: 'error', message: errorText(e) })
      })
    return () => { cancelled = true }
  }, [tenantId, userId, attempt])

  // A revocation made in another browser is picked up when this tab is revisited.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') setAttempt(value => value + 1)
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])

  if (state.status === 'allowed') return children

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between gap-3" style={{ minHeight: 56 }}>
          <button
            className="wordmark cursor-pointer text-left"
            onClick={() => navigate(`/t/${currentTenantSlug()}/schedule`)}
            aria-label={`${teamName} public schedule`}
          >
            {teamName}
            <span style={{ marginLeft: 8, fontSize: 11, letterSpacing: '0.04em', fontWeight: 600, color: 'hsl(var(--royal))', textTransform: 'none' }}>
              by Crewlist
            </span>
          </button>
          <button
            className="chip cursor-pointer flex-none"
            onClick={async () => {
              await onSignOut()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="page flex-1 py-10 grid place-items-center w-full">
        {state.status === 'checking' && <Spinner label="Checking admin access…" />}
        {state.status === 'error' && (
          <ErrorBox message={`We couldn’t verify your admin access. ${state.message}`} onRetry={() => setAttempt(value => value + 1)} />
        )}
        {state.status === 'denied' && (
          <div className="panel p-6 sm:p-8 space-y-5 w-full fade-in">
            <div>
              <div className="eyebrow">Team access</div>
              <h1 className="font-semibold" style={{ fontSize: 24 }}>You don’t have admin access</h1>
              <p className="text-sm mt-2" style={{ color: 'hsl(var(--slate))' }}>
                This account can’t view or change {teamName}’s admin console. If your access was removed,
                ask a current team admin to send you a new invitation.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn-primary" onClick={() => navigate('/login')}>Go to your teams</button>
              <button className="btn-ghost" onClick={() => navigate(`/t/${currentTenantSlug()}/schedule`)}>View public schedule</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
