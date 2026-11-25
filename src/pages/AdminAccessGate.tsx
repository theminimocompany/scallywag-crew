import { useEffect, useState } from 'react'
import { checkAdminAccess, errorText } from '@/lib/api'
import { navigate } from '@/lib/hash'
import { currentTenantSlug, useTeamName } from '@/lib/tenant'
import { ClButton, ClNotice, ClSkeleton, TeamBrand } from '@/components/CrewlistUI'

type AccessState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'denied' }
  | { status: 'error'; message: string }

export type AdminAccessPreview = 'checking' | 'denied' | 'error'

interface Props {
  tenantId: string
  userId: string
  onSignOut: () => Promise<void>
  children: React.ReactNode
  preview?: AdminAccessPreview
}

/** Do not mount the admin header or pages until this team's access is proven. */
export default function AdminAccessGate({ tenantId, userId, onSignOut, children, preview }: Props) {
  const teamName = useTeamName()
  const [state, setState] = useState<AccessState>(() => preview === 'denied'
    ? { status: 'denied' }
    : preview === 'error'
      ? { status: 'error', message: 'Synthetic access-check failure.' }
      : { status: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (preview) return
    let cancelled = false
    checkAdminAccess(tenantId, userId)
      .then(allowed => {
        if (!cancelled) setState({ status: allowed ? 'allowed' : 'denied' })
      })
      .catch(e => {
        if (!cancelled) setState({ status: 'error', message: errorText(e) })
      })
    return () => { cancelled = true }
  }, [tenantId, userId, attempt, preview])

  useEffect(() => {
    if (preview) return
    const recheck = () => {
      if (document.visibilityState === 'visible') setAttempt(value => value + 1)
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [preview])

  if (state.status === 'allowed') return children

  return (
    <div className="cl-root cl-admin-access">
      <header className="cl-public-header">
        <div className="cl-container cl-public-header__inner">
          <button
            type="button"
            className="cl-public-brand"
            onClick={() => navigate(preview ? '/mockups/admin/races/default' : `/t/${currentTenantSlug()}/schedule`)}
            aria-label={`${teamName} public schedule`}
          >
            <TeamBrand teamName={preview ? 'Testing101' : teamName} />
          </button>
          <ClButton
            variant="secondary"
            size="small"
            onClick={async () => {
              if (!preview) await onSignOut()
              navigate(preview ? '/mockups/auth/login/default' : '/login')
            }}
          >Sign out</ClButton>
        </div>
      </header>
      <main className="cl-container cl-admin-access-main">
        {state.status === 'checking' && <div className="cl-panel cl-admin-state"><ClSkeleton rows={3} label="Checking admin access" /></div>}
        {state.status === 'error' && (
          <ClNotice tone="error" title="We couldn’t verify your admin access" action={<ClButton variant="secondary" size="small" onClick={() => preview ? setState({ status: 'checking' }) : setAttempt(value => value + 1)}>Try again</ClButton>}>
            {state.message}
          </ClNotice>
        )}
        {state.status === 'denied' && (
          <div className="cl-panel cl-admin-access-denied">
            <p className="cl-eyebrow">Team access</p>
            <h1>You don’t have admin access</h1>
            <p>This account can’t view or change {preview ? 'Testing101' : teamName}’s admin console. If your access was removed, ask a current team admin to send you a new invitation.</p>
            <div>
              <ClButton onClick={() => navigate(preview ? '/mockups/onboarding/account/default' : '/login')}>Go to your teams</ClButton>
              <ClButton variant="secondary" onClick={() => navigate(preview ? '/mockups/schedule' : `/t/${currentTenantSlug()}/schedule`)}>View public schedule</ClButton>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
