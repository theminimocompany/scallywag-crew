import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClInput, ClNotice } from '@/components/CrewlistUI'

type ForgotPreview = 'default' | 'loading' | 'error' | 'sent' | 'invitation'

export default function ForgotPassword({ preview }: { preview?: ForgotPreview }) {
  const lockedEmail = preview
    ? preview === 'invitation' ? 'invited.admin@testing101.invalid' : ''
    : sessionStorage.getItem('crewlist_recovery_email') ?? ''
  const recoveryInvite = preview ? '' : sessionStorage.getItem('crewlist_recovery_invite') ?? ''
  const validRecoveryInvite = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recoveryInvite)
  const [email, setEmail] = useState(preview ? lockedEmail || 'skipper@testing101.invalid' : lockedEmail)
  const [busy, setBusy] = useState(preview === 'loading')
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'We couldn’t send the reset email. Try again shortly.' : null)
  const [sent, setSent] = useState(preview === 'sent')
  const [previewAction, setPreviewAction] = useState('Synthetic account details. No reset email, Auth request or recovery-storage change is made in this preview.')

  function backToSignIn() {
    if (preview) {
      setPreviewAction('Sign-in navigation is disabled in this isolated preview. Your return destination was not changed.')
      return
    }
    navigate(sessionStorage.getItem('crewlist_auth_return') || '#/login')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (preview) {
      setErr(null)
      setSent(true)
      setPreviewAction('The sent state was reached locally. No reset email was requested and no Auth request was sent.')
      return
    }
    setBusy(true)
    setErr(null)
    // Keep the callback out of the hash route. Implicit recovery returns
    // #access_token=… and PKCE returns ?code=…; both would corrupt a
    // #/reset-password destination. App.tsx routes to the form after auth.
    const redirect = new URL(`${window.location.origin}${window.location.pathname}`)
    redirect.searchParams.set('recovery', '1')
    if (lockedEmail && validRecoveryInvite) redirect.searchParams.set('invite', recoveryInvite)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirect.toString(),
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setSent(true)
  }

  return (
    <ClAuthShell
      onBrand={() => {
        if (preview) setPreviewAction('Brand navigation is disabled in this isolated preview. No live page was opened.')
        else navigate('/join')
      }}
      preview={preview ? previewAction : undefined}
      action={<ClButton variant="text" size="small" onClick={backToSignIn}>Sign in</ClButton>}
    >
      <div className="cl-auth-heading">
        <p className="cl-eyebrow">PASSWORD RECOVERY</p>
        <h1>Reset your password</h1>
        <p>{sent ? 'Check your email for a secure reset link.' : 'Enter your account email and we’ll send you a reset link.'}</p>
      </div>

      {sent ? (
        <div className="cl-auth-stack">
          <ClNotice tone="success" title="Check your inbox">
            If an account exists for <span className="cl-auth-email">{email.trim()}</span>, a reset email is on its way. Open the link in this same browser. If it doesn’t arrive within a few minutes, check your spam or junk folder.
          </ClNotice>
          <ClButton variant="secondary" full onClick={() => {
            setSent(false)
            setErr(null)
            if (preview) setPreviewAction('The recovery form is editable again. No Auth request or recovery-storage change was made.')
          }}>
            Use a different email
          </ClButton>
        </div>
      ) : (
        <form onSubmit={submit} className="cl-auth-form">
          <ClInput
            id="recovery-email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            autoFocus={!lockedEmail}
            readOnly={!!lockedEmail}
            aria-readonly={!!lockedEmail}
            placeholder="you@boat.com"
            hint={lockedEmail ? 'This address is fixed by your invitation.' : undefined}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {err && <ClNotice tone="error" title="Reset email not sent">{err}</ClNotice>}
          <ClButton full loading={busy} type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </ClButton>
        </form>
      )}

      <div className="cl-auth-footer-action">
        <ClButton variant="text" onClick={backToSignIn}>Back to sign in</ClButton>
      </div>
    </ClAuthShell>
  )
}
