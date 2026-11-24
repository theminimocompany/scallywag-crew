import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { currentTenantSlug, useTeamName } from '@/lib/tenant'
import { ClAuthShell, ClButton, ClInput, ClNotice } from '@/components/CrewlistUI'

type LoginPreview = 'default' | 'loading' | 'error'

export default function AdminLogin({ crewlist = false, preview }: { crewlist?: boolean; preview?: LoginPreview }) {
  const [email, setEmail] = useState(preview ? 'skipper@testing101.invalid' : '')
  const [password, setPassword] = useState(preview ? 'synthetic-password' : '')
  const [busy, setBusy] = useState(preview === 'loading')
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Invalid login credentials.' : null)
  const [previewAction, setPreviewAction] = useState('Synthetic account details. Auth requests and recovery storage are disabled in this preview.')
  const liveTeamName = useTeamName()
  const teamName = preview ? 'Testing101' : liveTeamName

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (preview) {
      setErr(null)
      setPreviewAction('Sign-in was simulated locally. No Auth request was sent and no session was created.')
      return
    }
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  function openBrandDestination() {
    if (preview) {
      setPreviewAction('Brand navigation is disabled in this isolated preview. No live page was opened.')
      return
    }
    navigate(crewlist ? '/join' : `/t/${currentTenantSlug()}/schedule`)
  }

  function forgotPassword() {
    if (preview) {
      setPreviewAction('Password recovery is previewed separately. No return destination or recovery storage was changed.')
      return
    }
    sessionStorage.setItem('crewlist_auth_return', window.location.hash || '#/login')
    sessionStorage.removeItem('crewlist_recovery_email')
    sessionStorage.removeItem('crewlist_recovery_invite')
    navigate('/forgot-password')
  }

  return (
    <ClAuthShell
      teamName={crewlist ? undefined : teamName}
      onBrand={openBrandDestination}
      preview={preview ? previewAction : undefined}
      action={crewlist ? (
        <ClButton variant="text" size="small" onClick={() => {
          if (preview) setPreviewAction('Team creation is outside this login preview. No live page was opened.')
          else navigate('/join')
        }}>
          Start a new team
        </ClButton>
      ) : (
        <ClButton variant="text" size="small" onClick={() => navigate(`/t/${currentTenantSlug()}/admin`)}>Admin</ClButton>
      )}
    >
      <div className="cl-auth-heading">
        {crewlist && <p className="cl-eyebrow">ACCOUNT ACCESS</p>}
        <h1>{crewlist ? 'Sign in' : 'Team admin'}</h1>
        <p>Sign in with your email and password.</p>
      </div>

      <form onSubmit={signIn} className="cl-auth-form">
        <ClInput
          id="login-email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@boat.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <ClInput
          id="login-password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {err && <ClNotice tone="error" title="Sign-in failed">{err}</ClNotice>}
        <ClButton full loading={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </ClButton>
        <div className="cl-auth-form__meta">
          <ClButton variant="text" type="button" onClick={forgotPassword}>Forgot password?</ClButton>
        </div>
      </form>
    </ClAuthShell>
  )
}
