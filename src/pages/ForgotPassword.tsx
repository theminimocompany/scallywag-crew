import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ErrText } from '@/components/bits'

export default function ForgotPassword() {
  const lockedEmail = sessionStorage.getItem('crewlist_recovery_email') ?? ''
  const recoveryInvite = sessionStorage.getItem('crewlist_recovery_invite') ?? ''
  const validRecoveryInvite = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recoveryInvite)
  const [email, setEmail] = useState(lockedEmail)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function backToSignIn() {
    navigate(sessionStorage.getItem('crewlist_auth_return') || '#/login')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
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
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <button className="wordmark cursor-pointer" style={{ textTransform: 'none' }} onClick={() => navigate('/join')}>Crewlist.</button>
          <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--slate))', minHeight: 44 }} onClick={backToSignIn}>
            Sign in
          </button>
        </div>
      </header>
      <main className="page flex-1 py-10 fade-in">
        <div className="panel p-6 space-y-5">
          <div>
            <h1 className="font-semibold" style={{ fontSize: 22 }}>Reset your password</h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'hsl(var(--slate))' }}>
              {sent ? 'Check your email for a secure reset link.' : 'Enter your account email and we’ll send you a reset link.'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--slate))' }}>
                If an account exists for <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{email.trim()}</span>, a reset email is on its way. Open the link in this same browser.
              </p>
              <button className="btn-ghost w-full" onClick={() => { setSent(false); setErr(null) }}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="recovery-email" className="text-xs font-medium block mb-1.5">Email</label>
                <input
                  id="recovery-email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus={!lockedEmail}
                  readOnly={!!lockedEmail}
                  aria-readonly={!!lockedEmail}
                  placeholder="you@boat.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                {lockedEmail && (
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                    This address is fixed by your invitation.
                  </p>
                )}
              </div>
              {err && <ErrText>{err}</ErrText>}
              <button className="btn-primary w-full" disabled={busy} type="submit">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <button
            className="text-xs font-medium cursor-pointer"
            style={{ color: 'hsl(var(--royal))', minHeight: 44 }}
            onClick={backToSignIn}
          >
            Back to sign in
          </button>
        </div>
      </main>
    </div>
  )
}
