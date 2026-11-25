import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { acceptInvite, errorText } from '@/lib/api'
import { navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClNotice } from '@/components/CrewlistUI'

export type AcceptInvitePreview = 'accepting' | 'success' | 'error' | 'incomplete'

interface AcceptedTeam { id: string; name: string; slug: string }

const PREVIEW_TEAM: AcceptedTeam = { id: 'synthetic-team', name: 'Sea Wolf', slug: 'sea-wolf' }

// React StrictMode can mount an effect twice. Share the in-flight redemption so
// a single-use token is never submitted twice by the same page.
const redemptions = new Map<string, Promise<AcceptedTeam>>()

async function redeem(token: string): Promise<AcceptedTeam> {
  const tenantId = await acceptInvite(token)
  const { data, error } = await supabase
    .from('tenants').select('id,name,slug').eq('id', tenantId).single()
  if (error) throw error
  return data as AcceptedTeam
}

function redeemOnce(token: string): Promise<AcceptedTeam> {
  const existing = redemptions.get(token)
  if (existing) return existing
  const pending = redeem(token)
  redemptions.set(token, pending)
  return pending
}

export default function AcceptInvite({ token, email, onSignOut, preview }: {
  token: string
  email: string
  onSignOut: () => Promise<void>
  preview?: AcceptInvitePreview
}) {
  const [stage, setStage] = useState<'accepting' | 'success' | 'error'>(
    preview === 'success' ? 'success' : preview === 'error' || preview === 'incomplete' ? 'error' : 'accepting',
  )
  const [team, setTeam] = useState<AcceptedTeam | null>(preview === 'success' ? PREVIEW_TEAM : null)
  const [err, setErr] = useState<string | null>(
    preview === 'incomplete' ? 'This invite link is incomplete. Ask the team admin for a fresh link.'
      : preview === 'error' ? 'This invitation is invalid, expired, or was sent to another email address.' : null,
  )
  const [attempt, setAttempt] = useState(0)
  const [previewAction, setPreviewAction] = useState('Synthetic acceptance state. Invitation redemption, tenant lookup, sign-out, recovery storage and navigation are disabled in this preview.')

  useEffect(() => {
    if (preview) return
    let cancelled = false
    if (!token) {
      setStage('error')
      setErr('This invite link is incomplete. Ask the team admin for a fresh link.')
      return
    }
    setStage('accepting')
    setErr(null)
    redeemOnce(token)
      .then(accepted => {
        // Do not replay a cached success if this link is revisited later or by
        // another signed-in account in the same browser session.
        redemptions.delete(token)
        if (cancelled) return
        sessionStorage.removeItem('crewlist_auth_return')
        sessionStorage.removeItem('crewlist_recovery_email')
        sessionStorage.removeItem('crewlist_recovery_invite')
        setTeam(accepted)
        setStage('success')
      })
      .catch(e => {
        // Permit an explicit retry after an expired/network/authorization error.
        redemptions.delete(token)
        if (cancelled) return
        setErr(errorText(e))
        setStage('error')
      })
    return () => { cancelled = true }
  }, [token, attempt, preview])

  async function signOut() {
    if (preview) {
      setPreviewAction('Sign-out was simulated locally. The Auth session and invitation return destination were not changed.')
      return
    }
    await onSignOut()
  }

  function openBrandDestination() {
    if (preview) {
      setPreviewAction('Brand navigation is disabled in this isolated preview. No live page was opened.')
      return
    }
    navigate('/login')
  }

  function openTeam(destination: 'admin' | 'schedule') {
    if (preview) {
      setPreviewAction(`${destination === 'admin' ? 'Team admin' : 'Public schedule'} navigation is disabled in this isolated preview. No live team page was opened.`)
      return
    }
    if (team) navigate(`/t/${team.slug}/${destination}`)
  }

  function retry() {
    if (preview) {
      setPreviewAction('Acceptance retry was simulated locally. No invitation RPC or tenant lookup was sent.')
      return
    }
    setAttempt(n => n + 1)
  }

  function backToTeams() {
    if (preview) {
      setPreviewAction('Account navigation is disabled in this isolated preview. No live page was opened.')
      return
    }
    navigate('/login')
  }

  return (
    <ClAuthShell
      onBrand={openBrandDestination}
      preview={preview ? previewAction : undefined}
      previewTitle="Step 3C preview"
      action={<ClButton variant="text" size="small" onClick={signOut}>Sign out</ClButton>}
    >
      <div aria-live="polite">
        {stage === 'accepting' && (
          <div className="cl-auth-loading" role="status">
            <span className="cl-auth-spinner" aria-hidden="true" />
            <h1>Accepting your invite</h1>
            <p>Signed in as <span className="cl-auth-email">{email}</span>. Keep this page open while we add you to the team.</p>
            <p className="cl-invite-progress">Confirming co-admin access…</p>
          </div>
        )}

        {stage === 'success' && team && (
          <div className="cl-auth-stack">
            <span className="cl-onboard-success-mark" aria-hidden="true">✓</span>
            <div className="cl-auth-heading cl-invite-heading">
              <p className="cl-eyebrow">INVITE ACCEPTED</p>
              <h1>You’re now an admin of {team.name}</h1>
              <p>You can manage races, crew, sign-ups and team settings. Sailors still won’t need accounts.</p>
            </div>
            <ClButton full onClick={() => openTeam('admin')}>Open team admin</ClButton>
            <ClButton variant="secondary" full onClick={() => openTeam('schedule')}>View public schedule</ClButton>
          </div>
        )}

        {stage === 'error' && (
          <div className="cl-auth-stack">
            <div className="cl-auth-heading">
              <p className="cl-eyebrow">CO-ADMIN INVITE</p>
              <h1>We couldn’t accept this invite</h1>
              <p>You’re signed in as <span className="cl-auth-email">{email}</span>. If the invite was sent to another address, sign out and use that email instead.</p>
            </div>
            {err && <ClNotice tone="error" title="Invitation not accepted">{err}</ClNotice>}
            {token && <ClButton full onClick={retry}>Try again</ClButton>}
            <ClButton variant="secondary" full onClick={signOut}>Use a different account</ClButton>
            <ClButton variant="ghost" full onClick={backToTeams}>Back to your teams</ClButton>
          </div>
        )}
      </div>
    </ClAuthShell>
  )
}
