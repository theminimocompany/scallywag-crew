import { useState } from 'react'
import { navigate } from '@/lib/hash'
import { ClButton, ClStatus, CrewlistBrand } from '@/components/CrewlistUI'

/** Console-only header: Crewlist wordmark, super-admin identity, sign out. */
export function ConsoleChrome({
  email,
  onSignOut,
  preview = false,
}: {
  email: string
  onSignOut: () => void
  preview?: boolean
}) {
  const [previewNotice, setPreviewNotice] = useState('')

  function handleSignOut() {
    if (preview) {
      setPreviewNotice('Sign-out was simulated. No Auth request was made.')
      return
    }
    onSignOut()
  }

  return (
    <header className="cl-public-header cl-console-header">
      <div className="cl-container cl-container--marketing cl-public-header__inner cl-console-header__inner">
        <button
          type="button"
          className="cl-public-brand"
          onClick={() => navigate(preview ? '/mockups/console' : '/console')}
          aria-label="Crewlist console home"
        >
          <CrewlistBrand compact />
        </button>
        <div className="cl-console-header__account">
          <span className="cl-console-identity">Super admin · {email}</span>
          <ClButton variant="secondary" size="small" onClick={handleSignOut}>Sign out</ClButton>
        </div>
      </div>
      {previewNotice && (
        <div className="cl-container cl-container--marketing cl-console-header__notice" role="status">
          {previewNotice}
        </div>
      )}
    </header>
  )
}

export function StatusChip({ status }: { status: 'active' | 'suspended' | 'past_due' }) {
  const map = {
    active: { label: 'Active', tone: 'open' },
    suspended: { label: 'Suspended', tone: 'danger' },
    past_due: { label: 'Past due', tone: 'warning' },
  } as const
  const s = map[status] ?? map.active
  return <ClStatus tone={s.tone}>{s.label}</ClStatus>
}
