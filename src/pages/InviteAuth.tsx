import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'

/** Password-only account setup and sign-in for a co-admin invitation. */
export default function InviteAuth() {
  const [mode, setMode] = useState<'setup' | 'signin'>('setup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

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
    if (!fullName.trim()) return setErr('Enter your name.')
    if (password.length < 8) return setErr('Use at least 8 characters for your password.')
    if (password !== confirmation) return setErr('The two passwords do not match.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
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

    // With email confirmation enabled there is no session yet. The saved
    // invitation return is restored after the emailed confirmation succeeds.
    if (!data.session) setSent(true)
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) setErr(error.message)
  }

  function setPasswordInstead() {
    sessionStorage.setItem('crewlist_auth_return', window.location.hash)
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
          {sent ? (
            <div className="space-y-4" aria-live="polite">
              <div>
                <div className="eyebrow">Co-admin account</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>Confirm your email</h1>
              </div>
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
                We sent a confirmation link to <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{email}</span>.
                Open it in this same browser. You’ll return to this invitation automatically,
                and your team access will be added.
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
                    : 'Use the email address this invitation was sent to.'}
                </p>
              </div>

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
                  <label htmlFor="invite-email" className="text-xs font-medium block mb-1">Email</label>
                  <input
                    id="invite-email" className="input" type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
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

              <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                The invitation only works for the invited email address.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
