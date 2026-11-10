import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ErrText } from '@/components/bits'
import { checkSlugAvailable, createTeam } from '@/lib/api'

const PENDING_KEY = 'crewlist_pending_team'

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export default function Join({ session }: { session: Session | null }) {
  const pending = (() => {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') as { name: string; slug: string } | null }
    catch { return null }
  })()
  const [name, setName] = useState(pending?.name ?? '')
  const [slug, setSlug] = useState(pending?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!pending)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const creating = useRef(false)

  const validSlug = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)

  // live availability check (anon can read tenant slugs by design)
  useEffect(() => {
    setAvailable(null)
    if (!validSlug) return
    const t = setTimeout(() => {
      checkSlugAvailable(slug).then(setAvailable).catch(() => setAvailable(null))
    }, 400)
    return () => clearTimeout(t)
  }, [slug])

  // Once signed in (password sign-up, or returning from the emailed link),
  // finish creating the team from the stashed pending details.
  useEffect(() => {
    if (!session || creating.current) return
    let details = pending
    if (!details && name.trim() && validSlug) details = { name: name.trim(), slug }
    if (!details) return
    creating.current = true
    setBusy(true)
    createTeam(details.name, details.slug)
      .then(() => {
        sessionStorage.removeItem(PENDING_KEY)
        navigate(`/t/${details.slug}/onboard`)
      })
      .catch(e => {
        creating.current = false
        setBusy(false)
        setErr(e?.code === '23505' ? 'That team link is taken — try another.' : (e?.message ?? String(e)))
      })
  }, [session])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('Give your team a name.')
    if (!validSlug) return setErr('Team link: 3–40 chars, lowercase letters, numbers and dashes.')
    if (available === false) return setErr('That team link is taken — try another.')
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name: name.trim(), slug }))
    sessionStorage.setItem('crewlist_auth_return', '#/join')

    if (session) return // signed-in path handled by the effect above

    if (password.length < 8) return setErr('Use at least 8 characters for your password.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })
    setBusy(false)
    if (error) return setErr(error.message)
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      return setErr('This email already has an account — use Sign in at the top right.')
    }
    if (!data.session) setSent(true) // confirm-email required; link returns here
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <span className="wordmark" style={{ textTransform: 'none' }}>Crewlist.</span>
          <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--slate))', minHeight: 44 }} onClick={() => navigate('/login')}>
            Sign in
          </button>
        </div>
      </header>

      <main className="page flex-1 py-8 fade-in">
        <div className="flex gap-1 p-1 panel mb-6" role="tablist" aria-label="Join or sign in">
          <button role="tab" aria-selected className="chip chip-on cursor-pointer flex-1" onClick={() => navigate('/join')}>Start a new team</button>
          <button role="tab" aria-selected={false} className="chip cursor-pointer flex-1" onClick={() => navigate('/login')}>I have an account</button>
        </div>

        <h1 className="font-semibold" style={{ fontSize: 24 }}>Create your team</h1>
        <p className="text-sm mt-1 mb-6" style={{ color: 'hsl(var(--slate))' }}>
          Two minutes now, then import your races and crew. Your team goes live immediately.
        </p>

        {sent ? (
          <div className="panel p-6 space-y-3">
            <p className="font-medium">Check your email</p>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              We sent a link to <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{email}</span>.
              Open it <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>in this same browser</span> —
              you'll come straight back here and <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{name}</span> will be created automatically.
            </p>
            <button className="btn-ghost w-full" onClick={() => { setSent(false); setBusy(false) }}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="boat" className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Boat / team name</label>
              <input id="boat" className="input" required maxLength={60} value={name}
                onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
            </div>
            <div className="panel p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm break-all">
                  {window.location.host}/#/t/<span className="font-semibold" style={{ color: 'hsl(var(--royal))' }}>{slug || '…'}</span>
                </span>
                {validSlug && available === true && <span className="text-xs font-semibold" style={{ color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '3px 10px' }}>Available ✓</span>}
                {validSlug && available === false && <span className="text-xs font-semibold" style={{ color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '3px 10px' }}>Taken</span>}
              </div>
              <p className="text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                This is the link your crew will bookmark. It can't be changed later.
              </p>
              <button type="button" className="text-xs font-medium cursor-pointer mt-1" style={{ color: 'hsl(var(--royal))', minHeight: 32 }}
                onClick={() => { const next = window.prompt('Customise your team link (lowercase, dashes):', slug); if (next !== null) { setSlug(slugify(next)); setSlugTouched(true) } }}>
                Customise link
              </button>
            </div>

            {!session && (
              <>
                <div>
                  <label htmlFor="fullname" className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Your name</label>
                  <input id="fullname" className="input" placeholder="e.g. Marco Bellini" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="email" className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Email</label>
                  <input id="email" className="input" type="email" required autoComplete="email" placeholder="you@boat.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="password" className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Password</label>
                  <input id="password" className="input" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                    Use at least 8 characters. We’ll email you a confirmation link before creating the team.
                  </p>
                </div>
              </>
            )}
            {session && (
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>Signed in as <span className="font-medium" style={{ color: 'hsl(var(--ink))' }}>{session.user.email}</span> — hit Create team and you're done.</p>
            )}

            {err && <ErrText>{err}</ErrText>}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Working…' : 'Create team →'}
            </button>
            <p className="text-xs text-center" style={{ color: 'hsl(var(--slate))' }}>No approval step — your team is live immediately.</p>
          </form>
        )}
      </main>
    </div>
  )
}
