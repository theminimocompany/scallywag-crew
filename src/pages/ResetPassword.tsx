import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ErrText } from '@/components/bits'
import { Spinner } from '@/components/bits'

export default function ResetPassword({ session, authReady }: { session: Session | null; authReady: boolean }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) return setErr('Use at least 8 characters for your new password.')
    if (password !== confirmation) return setErr('The two passwords do not match.')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setBusy(false)
      return setErr(error.message)
    }

    // The password has already changed. A failure here must not be presented
    // as a failed reset, and the current recovery session stays signed in.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
    setBusy(false)
    if (signOutError) setWarning('Your password was changed, but other devices could not be signed out automatically.')
    setDone(true)
  }

  function backToSignIn() {
    navigate(sessionStorage.getItem('crewlist_auth_return') || '#/login')
  }

  function continueToDestination() {
    const back = sessionStorage.getItem('crewlist_auth_return') || '#/login'
    sessionStorage.removeItem('crewlist_auth_return')
    navigate(back)
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <button className="wordmark cursor-pointer" style={{ textTransform: 'none' }} onClick={() => navigate('/join')}>Crewlist.</button>
          {!session && (
            <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--slate))', minHeight: 44 }} onClick={backToSignIn}>
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="page flex-1 py-10 fade-in">
        <div className="panel p-6 space-y-5">
          {!authReady ? (
            <div className="py-8 grid place-content-center"><Spinner label="Checking reset link…" /></div>
          ) : done ? (
            <>
              <div>
                <h1 className="font-semibold" style={{ fontSize: 22 }}>Password updated</h1>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'hsl(var(--slate))' }}>
                  Your new password is active. Other devices have been signed out{warning ? ' where possible' : ''}.
                </p>
              </div>
              {warning && (
                <p className="text-sm leading-relaxed" role="status" style={{ color: 'hsl(var(--slate))' }}>{warning}</p>
              )}
              <button className="btn-primary w-full" onClick={continueToDestination}>Continue</button>
            </>
          ) : !session ? (
            <>
              <div>
                <h1 className="font-semibold" style={{ fontSize: 22 }}>This reset link is no longer valid</h1>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'hsl(var(--slate))' }}>
                  It may have expired or already been used. Request a fresh link to continue.
                </p>
              </div>
              <button className="btn-primary w-full" onClick={() => navigate('/forgot-password')}>Request a new link</button>
              <button className="btn-ghost w-full" onClick={backToSignIn}>Back to sign in</button>
            </>
          ) : (
            <>
              <div>
                <h1 className="font-semibold" style={{ fontSize: 22 }}>Choose a new password</h1>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'hsl(var(--slate))' }}>
                  Use at least eight characters. This will sign out your other devices.
                </p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="text-xs font-medium block mb-1.5">New password</label>
                  <input
                    id="new-password"
                    className="input"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-xs font-medium block mb-1.5">Confirm new password</label>
                  <input
                    id="confirm-password"
                    className="input"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={e => setConfirmation(e.target.value)}
                  />
                </div>
                {err && <ErrText>{err}</ErrText>}
                <button className="btn-primary w-full" disabled={busy} type="submit">
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
