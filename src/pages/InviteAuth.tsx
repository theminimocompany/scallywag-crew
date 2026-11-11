import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { fetchInviteEmail } from '@/lib/api'
import { Spinner, ErrText } from '@/components/bits'

/** Password-only account setup and sign-in for a co-admin invitation. */
export default function InviteAuth({ token }: { token: string }) {
  const [notice] = useState(() => {
    const message = sessionStorage.getItem('crewlist_invite_notice')
    sessionStorage.removeItem('crewlist_invite_notice')
    return message
  })
  const [mode, setMode] = useState<'setup' | 'signin'>(notice ? 'signin' : 'setup')
  const [fullName, setFullName] = useState('')
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null)
  const [lookupState, setLookupState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const email = invitedEmail ?? ''

  useEffect(() => {
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
  }, [token])

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

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`,
      },
    })
    setBusy(false)
    if (error) return setErr(error.message)

    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      setMode('signin')
      setPassword('')
      setConfirmation('')
      return setErr('This email already has an account. Sign in, or use “Set your password” if you have never created one.')
    }

    // With email confirmation enabled there is no session yet. The invitation
    // token in the redirect works even without this browser's sessionStorage.
    if (!data.session) setSent(true)
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  function setPasswordInstead() {
    sessionStorage.setItem('crewlist_auth_return', window.location.hash)
    sessionStorage.setItem('crewlist_recovery_email', email)
    sessionStorage.setItem('crewlist_recovery_invite', token)
    navigate('/forgot-password')
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center" style={{ minHeight: 56 }}>
          <span className="wordmark" style={{ textTransform: 'none' }}>Crewlist.</span>
        </div>
      </header>

      <main className="page flex-1 py-10 fade-in">
        <div className="panel p-6 space-y-5">
          {lookupState === 'loading' ? (
            <div className="py-8 grid place-content-center"><Spinner label="Checking your invitation…" /></div>
          ) : lookupState === 'error' ? (
            <div className="space-y-4">
              <div>
                <div className="eyebrow">Co-admin invitation</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>This invitation isn’t available</h1>
              </div>
              <ErrText>Ask the team admin for a fresh invitation link. The link may be invalid, revoked or expired.</ErrText>
            </div>
          ) : sent ? (
            <div className="space-y-4" aria-live="polite">
              <div>
                <div className="eyebrow">Co-admin account</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>Confirm your email</h1>
              </div>
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
                We sent a confirmation link to <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{email}</span>.
                Open it to return to this invitation automatically and accept your team access.
                If you don’t see it, check your spam or junk folder.
              </p>
              <button className="btn-ghost w-full" onClick={() => setSent(false)}>
                Back to account setup
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="eyebrow">Co-admin invitation</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>
                  {mode === 'setup' ? 'Set up your account' : 'Sign in to accept your invite'}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
                  {mode === 'setup'
                    ? 'Create your Crewlist login and confirm your email. You’ll return to this invitation automatically.'
                    : 'Sign in with the email address fixed by this invitation.'}
                </p>
              </div>

              {notice && <p className="text-sm" role="status" style={{ color: 'hsl(var(--slate))' }}>{notice}</p>}

              <form onSubmit={mode === 'setup' ? createAccount : signIn} className="space-y-3">
                {mode === 'setup' && (
                  <div>
                    <label htmlFor="invite-name" className="text-xs font-medium block mb-1">Your name</label>
                    <input
                      id="invite-name" className="input" required autoComplete="name"
                      value={fullName} onChange={e => setFullName(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="invite-email" className="text-xs font-medium block mb-1">Invited email</label>
                  <input
                    id="invite-email" className="input" type="email" required readOnly
                    autoComplete="email" aria-readonly="true"
                    value={email}
                  />
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                    This address is fixed by your invitation and cannot be changed here.
                  </p>
                </div>
                <div>
                  <label htmlFor="invite-password" className="text-xs font-medium block mb-1">
                    {mode === 'setup' ? 'Create a password' : 'Password'}
                  </label>
                  <input
                    id="invite-password" className="input" type="password" required
                    minLength={mode === 'setup' ? 8 : undefined}
                    autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'setup' ? 'At least 8 characters' : undefined}
                    value={password} onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {mode === 'setup' && (
                  <div>
                    <label htmlFor="invite-confirmation" className="text-xs font-medium block mb-1">Confirm password</label>
                    <input
                      id="invite-confirmation" className="input" type="password" required
                      minLength={8} autoComplete="new-password"
                      value={confirmation} onChange={e => setConfirmation(e.target.value)}
                    />
                  </div>
                )}

                {err && <p className="text-sm font-medium" role="alert" style={{ color: 'hsl(var(--destructive))' }}>{err}</p>}
                <button className="btn-primary w-full" disabled={busy} type="submit">
                  {busy
                    ? 'Working…'
                    : mode === 'setup' ? 'Create account →' : 'Sign in and accept invite →'}
                </button>
              </form>

              {mode === 'signin' && (
                <button
                  type="button" className="text-xs font-medium cursor-pointer block w-full text-right"
                  style={{ color: 'hsl(var(--royal))', minHeight: 44 }}
                  onClick={setPasswordInstead}
                >
                  Forgot password or need to set your first one?
                </button>
              )}

              <button
                type="button" className="text-xs font-medium cursor-pointer"
                style={{ color: 'hsl(var(--royal))', minHeight: 44 }}
                onClick={() => switchMode(mode === 'setup' ? 'signin' : 'setup')}
              >
                {mode === 'setup'
                  ? 'Already have a Crewlist account? Sign in'
                  : 'New to Crewlist? Set up your account'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
