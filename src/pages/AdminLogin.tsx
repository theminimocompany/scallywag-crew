import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PublicHeader } from '@/components/chrome'
import { navigate } from '@/lib/hash'

export default function AdminLogin({ crewlist = false }: { crewlist?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      {crewlist ? (
        <header className="hairline-b">
          <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
            <button className="wordmark cursor-pointer" style={{ textTransform: 'none' }} onClick={() => navigate('/join')}>Crewlist.</button>
            <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--slate))', minHeight: 44 }} onClick={() => navigate('/join')}>
              Start a new team
            </button>
          </div>
        </header>
      ) : <PublicHeader />}
      <main className="page flex-1 py-10 fade-in">
        <div className="panel p-6 space-y-5">
          <div>
            <h1 className="font-semibold" style={{ fontSize: 22 }}>{crewlist ? 'Sign in' : 'Team admin'}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
              Sign in with your email and password.
            </p>
          </div>

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
          <button
            type="button"
            className="text-xs font-medium cursor-pointer block w-full text-right"
            style={{ color: 'hsl(var(--royal))', minHeight: 44 }}
            onClick={() => {
              sessionStorage.setItem('crewlist_auth_return', window.location.hash || '#/login')
              sessionStorage.removeItem('crewlist_recovery_email')
              sessionStorage.removeItem('crewlist_recovery_invite')
              navigate('/forgot-password')
            }}
          >
            Forgot password?
          </button>
        </div>
      </main>
    </div>
  )
}
