import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClEmpty, ClNotice, ClSkeleton, ClStatus } from '@/components/CrewlistUI'

interface Membership { tenant_id: string; tenants: { name: string; slug: string; status: string } | null }

export type AccountHomePreview = 'default' | 'loading' | 'empty' | 'error' | 'suspended'

const PREVIEW_TEAMS: Membership[] = [
  { tenant_id: 'synthetic-team-1', tenants: { name: 'Sea Wolf', slug: 'sea-wolf', status: 'active' } },
  { tenant_id: 'synthetic-team-2', tenants: { name: 'Harbour Cats', slug: 'harbour-cats', status: 'active' } },
]

function rowsForPreview(preview?: AccountHomePreview): Membership[] | null {
  if (!preview || preview === 'loading' || preview === 'error') return null
  if (preview === 'empty') return []
  if (preview === 'suspended') {
    return [{ tenant_id: 'synthetic-team-1', tenants: { name: 'Sea Wolf', slug: 'sea-wolf', status: 'suspended' } }]
  }
  return PREVIEW_TEAMS
}

/** Post-login home: every team you admin, plus the console entry if you have it. */
export default function AccountHome({ email, preview }: { email: string; preview?: AccountHomePreview }) {
  const [rows, setRows] = useState<Membership[] | null>(() => rowsForPreview(preview))
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'We couldn’t load your teams. Try again.' : null)
  const [previewNotice, setPreviewNotice] = useState<string | null>(null)

  async function load() {
    setErr(null)
    if (preview) {
      setRows(preview === 'empty' ? [] : PREVIEW_TEAMS)
      return
    }
    const { data, error } = await supabase
      .from('tenant_members').select('tenant_id, tenants(name,slug,status)')
    if (error) setErr(error.message)
    else setRows(data as unknown as Membership[])
  }
  useEffect(() => { if (!preview) void load() }, [preview])

  function goToJoin() {
    if (preview) {
      setPreviewNotice('Start a new team was simulated locally.')
      return
    }
    navigate('/join')
  }

  function openTeam(slug: string) {
    if (preview) {
      setPreviewNotice(`Opening /t/${slug}/admin was simulated locally.`)
      return
    }
    navigate(`/t/${slug}/admin`)
  }

  async function signOut() {
    if (preview) {
      setPreviewNotice('Sign-out was simulated locally. Your session is unchanged.')
      return
    }
    await supabase.auth.signOut()
    navigate('/join')
  }

  return (
    <ClAuthShell
      wide
      onBrand={() => {
        if (preview) setPreviewNotice('Account home navigation was simulated locally.')
        else navigate('/login')
      }}
      preview={preview ? `Synthetic ${preview} state. No membership lookup or sign-out will occur.` : undefined}
      previewTitle="Step 3B preview"
      action={<ClButton variant="secondary" size="small" onClick={() => void signOut()}>Sign out</ClButton>}
    >
      <div className="cl-account-heading">
        <div>
          <p className="cl-eyebrow">ACCOUNT HOME</p>
          <h1>Your teams</h1>
          <p>Signed in as <strong>{email}</strong>.</p>
        </div>
        <ClButton variant="secondary" onClick={goToJoin}>Start a new team →</ClButton>
      </div>

      {previewNotice && (
        <div className="cl-account-preview-result">
          <ClNotice tone="success" title="Preview only">{previewNotice}</ClNotice>
        </div>
      )}

      {!rows && !err && <ClSkeleton rows={2} label="Loading your teams" />}
      {err && (
        <ClNotice
          tone="error"
          title="Teams unavailable"
          action={<ClButton variant="secondary" size="small" onClick={() => void load()}>Try again</ClButton>}
        >
          {err}
        </ClNotice>
      )}
      {rows && rows.length > 0 && (
        <div className="cl-team-list">
          {rows.map(m => m.tenants && (
            <button key={m.tenant_id} type="button" className="cl-team-card" onClick={() => openTeam(m.tenants!.slug)}>
              <span className="cl-team-card__main">
                <strong>{m.tenants.name}</strong>
                <span className="cl-mono">/t/{m.tenants.slug}</span>
              </span>
              <span className="cl-team-card__action">
                {m.tenants.status === 'suspended' && <ClStatus tone="warning">Suspended</ClStatus>}
                <span>Open admin <span aria-hidden="true">→</span></span>
              </span>
            </button>
          ))}
        </div>
      )}
      {rows && rows.length === 0 && (
        <ClEmpty
          title="No teams yet"
          hint="You’re not an admin of any team yet. Start your own, or ask a team admin to invite you."
          action={<ClButton onClick={goToJoin}>Start a new team →</ClButton>}
        />
      )}
      {rows && rows.length > 0 && (
        <p className="cl-account-footnote">Need access to another boat? Ask its team admin to invite this email address.</p>
      )}
    </ClAuthShell>
  )
}
