import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PublicHeader } from '@/components/chrome'

export default function AdminLogin() {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    // No hash in the redirect: the emailed link comes back with ?code=… in the
    // query, and App.tsx forwards a fresh sign-in straight to the admin console.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    setBusy(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <PublicHeader />
      <main className="page flex-1 py-10 fade-in">
        <div className="panel p-6 space-y-5">
          <div>
            <h1 className="font-semibold" style={{ fontSize: 22 }}>Team admin</h1>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
              {mode === 'password'
                ? 'Sign in with your email and password.'
                : 'Get a one-tap sign-in link by email — no password needed.'}
            </p>
          </div>

          {mode === 'password' ? (
            <form onSubmit={signIn} className="space-y-3">
              <input
                className="input" type="email" required autoComplete="email"
                placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              />
              <input
                className="input" type="password" required autoComplete="current-password"
                placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              />
              {err && <p className="text-sm font-medium" role="alert" style={{ color: 'hsl(var(--destructive))' }}>{err}</p>}
              <button className="btn-primary w-full" disabled={busy} type="submit">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : sent ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
                Link sent to <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{email}</span>.
                Open it <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>in this same browser</span> —
                it only works where you asked for it. The link expires in an hour.
              </p>
              <button className="btn-ghost w-full" onClick={() => { setSent(false); setBusy(false) }}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                className="input" type="email" required autoComplete="email"
                placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              />
              {err && <p className="text-sm font-medium" role="alert" style={{ color: 'hsl(var(--destructive))' }}>{err}</p>}
              <button className="btn-primary w-full" disabled={busy} type="submit">
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <button
            className="text-xs font-medium cursor-pointer"
            style={{ color: 'hsl(var(--royal))', minHeight: 44 }}
            onClick={() => { setMode(m => (m === 'password' ? 'link' : 'password')); setErr(null); setSent(false) }}
          >
            {mode === 'password' ? 'No password handy? Use an email link instead' : 'Back to password sign-in'}
          </button>
        </div>
      </main>
    </div>
  )
}
