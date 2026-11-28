import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { appUrl, currentRoute, navigate } from '@/lib/hash'
import { fetchInviteEmail } from '@/lib/api'
import { ClAuthShell, ClButton, ClInput, ClNotice } from '@/components/CrewlistUI'

export type InviteAuthPreview =
  | 'loading'
  | 'invalid'
  | 'setup'
  | 'signin'
  | 'notice'
  | 'validation'
  | 'setup-loading'
  | 'setup-error'
  | 'existing-account'
  | 'sent'
  | 'signin-loading'
  | 'signin-error'

const PREVIEW_EMAIL = 'invited.admin@testing101.invalid'
const CALLBACK_NOTICE = 'We couldn’t sign you in automatically. If your email is already confirmed, sign in with your password to continue.'
const EXISTING_ACCOUNT_ERROR = 'This email already has an account. Sign in, or use “Set your password” if you have never created one.'

/** Password-only account setup and sign-in for a co-admin invitation. */
export default function InviteAuth({ token, preview }: { token: string; preview?: InviteAuthPreview }) {
  const [notice] = useState(() => {
    if (preview) return preview === 'notice' ? CALLBACK_NOTICE : null
    const message = sessionStorage.getItem('crewlist_invite_notice')
    sessionStorage.removeItem('crewlist_invite_notice')
    return message
  })
  const previewSignIn = preview === 'signin' || preview === 'notice' || preview === 'existing-account'
    || preview === 'signin-loading' || preview === 'signin-error'
  const [mode, setMode] = useState<'setup' | 'signin'>(notice || previewSignIn ? 'signin' : 'setup')
  const [fullName, setFullName] = useState(preview ? 'Alex Morgan' : '')
  const [invitedEmail, setInvitedEmail] = useState<string | null>(preview ? PREVIEW_EMAIL : null)
  const [lookupState, setLookupState] = useState<'loading' | 'ready' | 'error'>(
    preview === 'loading' ? 'loading' : preview === 'invalid' ? 'error' : preview ? 'ready' : 'loading',
  )
  const [password, setPassword] = useState(preview ? 'synthetic-password' : '')
  const [confirmation, setConfirmation] = useState(preview === 'validation' ? 'different-password' : preview ? 'synthetic-password' : '')
  const [busy, setBusy] = useState(preview === 'setup-loading' || preview === 'signin-loading')
  const [err, setErr] = useState<string | null>(
    preview === 'validation' ? 'The two passwords do not match.'
      : preview === 'setup-error' ? 'We couldn’t create your account. Try again shortly.'
        : preview === 'existing-account' ? EXISTING_ACCOUNT_ERROR
          : preview === 'signin-error' ? 'Invalid login credentials.' : null,
  )
  const [sent, setSent] = useState(preview === 'sent')
  const [previewAction, setPreviewAction] = useState('Synthetic invitation details. Token lookup, Auth requests, recovery storage and navigation are disabled in this preview.')
  const email = invitedEmail ?? ''

  useEffect(() => {
    if (preview) return
    let cancelled = false
    fetchInviteEmail(token)
      .then(inviteEmail => {
        if (cancelled) return
        if (!inviteEmail) {
          setLookupState('error')
          return
        }
        setInvitedEmail(inviteEmail)
        setLookupState('ready')
      })
      .catch(() => { if (!cancelled) setLookupState('error') })
    return () => { cancelled = true }
  }, [token, preview])

  function switchMode(next: 'setup' | 'signin') {
    setMode(next)
    setErr(null)
    setSent(false)
    setPassword('')
    setConfirmation('')
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!email) return setErr('This invitation has no valid email address. Ask for a fresh link.')
    if (!fullName.trim()) return setErr('Enter your name.')
    if (password.length < 8) return setErr('Use at least 8 characters for your password.')
    if (password !== confirmation) return setErr('The two passwords do not match.')

    if (preview) {
      setSent(true)
      setPreviewAction('The confirmation state was reached locally. No account was created, no email was sent and no invitation was redeemed.')
      return
    }

    setBusy(true)
    const redirect = new URL(appUrl())
    redirect.searchParams.set('invite', token)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: redirect.toString(),
      },
    })
    setBusy(false)
    if (error) return setErr(error.message)

    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      setMode('signin')
      setPassword('')
      setConfirmation('')
      return setErr(EXISTING_ACCOUNT_ERROR)
    }

    // With email confirmation enabled there is no session yet. The invitation
    // token in the redirect works even without this browser's sessionStorage.
    if (!data.session) setSent(true)
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (preview) {
      setErr(null)
      setPreviewAction('Sign-in was simulated locally. No Auth session was created and the invitation was not redeemed. Acceptance is previewed separately.')
      return
    }
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  function setPasswordInstead() {
    if (preview) {
      setPreviewAction('Password recovery is disabled in this isolated preview. No return, email or invitation storage was changed.')
      return
    }
    sessionStorage.setItem('crewlist_auth_return', currentRoute())
    sessionStorage.setItem('crewlist_recovery_email', email)
    sessionStorage.setItem('crewlist_recovery_invite', token)
    navigate('/forgot-password')
  }

  return (
    <ClAuthShell preview={preview ? previewAction : undefined} previewTitle="Step 3C preview">
      {lookupState === 'loading' ? (
        <div className="cl-auth-loading" role="status">
          <span className="cl-auth-spinner" aria-hidden="true" />
          <h1>Checking your invitation</h1>
          <p>One moment while we validate this co-admin link.</p>
        </div>
      ) : lookupState === 'error' ? (
        <div className="cl-auth-stack">
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">CO-ADMIN INVITATION</p>
            <h1>This invitation isn’t available</h1>
            <p>The link may be invalid, revoked or expired.</p>
          </div>
          <ClNotice tone="warning" title="Ask for a fresh invitation">
            The team admin can send you a new link. For security, an unavailable invitation cannot be used to set up or sign in to an account.
          </ClNotice>
        </div>
      ) : sent ? (
        <div className="cl-auth-stack" aria-live="polite">
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">CO-ADMIN ACCOUNT</p>
            <h1>Confirm your email</h1>
            <p>One more step before you can accept your team access.</p>
          </div>
          <ClNotice tone="success" title="Check your inbox">
            We sent a confirmation link to <span className="cl-auth-email">{email}</span>. Open it to return to this invitation automatically and accept your team access. If you don’t see it, check your spam or junk folder.
          </ClNotice>
          <ClButton variant="secondary" full onClick={() => {
            setSent(false)
            if (preview) setPreviewAction('The account setup form is editable again. No Auth request or invitation write was made.')
          }}>
            Back to account setup
          </ClButton>
        </div>
      ) : (
        <>
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">CO-ADMIN INVITATION</p>
            <h1>{mode === 'setup' ? 'Set up your account' : 'Sign in to accept your invite'}</h1>
            <p>
              {mode === 'setup'
                ? 'Create your Crewlist login and confirm your email. You’ll return to this invitation automatically.'
                : 'Sign in with the email address fixed by this invitation.'}
            </p>
          </div>

          <form onSubmit={mode === 'setup' ? createAccount : signIn} className="cl-auth-form">
            {notice && <ClNotice tone="info" title="Continue with your password">{notice}</ClNotice>}
            {mode === 'setup' && (
              <ClInput
                id="invite-name"
                label="Your name"
                required
                autoComplete="name"
                placeholder="Your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            )}
            <ClInput
              id="invite-email"
              label="Invited email"
              type="email"
              required
              readOnly
              autoComplete="email"
              aria-readonly="true"
              hint="This address is fixed by your invitation and cannot be changed here."
              value={email}
            />
            <ClInput
              id="invite-password"
              label={mode === 'setup' ? 'Create a password' : 'Password'}
              type="password"
              required
              minLength={mode === 'setup' ? 8 : undefined}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'setup' ? 'At least 8 characters' : 'Your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {mode === 'setup' && (
              <ClInput
                id="invite-confirmation"
                label="Confirm password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
              />
            )}

            {err && <ClNotice tone="error" title="Check your invitation details">{err}</ClNotice>}
            <ClButton full loading={busy} type="submit">
              {busy
                ? mode === 'setup' ? 'Creating account…' : 'Signing in…'
                : mode === 'setup' ? 'Create account' : 'Sign in and accept invite'}
            </ClButton>
          </form>

          {mode === 'signin' && (
            <div className="cl-auth-form__meta">
              <ClButton variant="text" type="button" onClick={setPasswordInstead}>
                Forgot password or need to set your first one?
              </ClButton>
            </div>
          )}

          <div className="cl-auth-footer-action">
            <ClButton variant="text" type="button" onClick={() => switchMode(mode === 'setup' ? 'signin' : 'setup')}>
              {mode === 'setup'
                ? 'Already have an account? Sign in'
                : 'New to Crewlist? Set up your account'}
            </ClButton>
          </div>
        </>
      )}
    </ClAuthShell>
  )
}
