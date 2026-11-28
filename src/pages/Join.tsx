import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { appUrl, navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClInput, ClNotice, ClStatus } from '@/components/CrewlistUI'
import { checkSlugAvailable, createTeam } from '@/lib/api'

const PENDING_KEY = 'crewlist_pending_team'

export type JoinPreview =
  | 'default'
  | 'checking'
  | 'available'
  | 'taken'
  | 'validation'
  | 'loading'
  | 'error'
  | 'sent'
  | 'signed-in'

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export default function Join({ session, preview }: { session: Session | null; preview?: JoinPreview }) {
  const pending = (() => {
    if (preview) return null
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') as { name: string; slug: string } | null }
    catch { return null }
  })()
  const hasPreviewDetails = !!preview && preview !== 'default' && preview !== 'validation'
  const [name, setName] = useState(pending?.name ?? (hasPreviewDetails ? 'Sea Wolf' : ''))
  const [slug, setSlug] = useState(pending?.slug ?? (hasPreviewDetails ? 'sea-wolf' : ''))
  const [slugTouched, setSlugTouched] = useState(!!pending)
  const [available, setAvailable] = useState<boolean | null>(() => {
    if (preview === 'taken') return false
    if (preview && hasPreviewDetails && preview !== 'checking') return true
    return null
  })
  const [fullName, setFullName] = useState(hasPreviewDetails ? 'Alex Morgan' : '')
  const [email, setEmail] = useState(hasPreviewDetails ? 'alex@example.com' : '')
  const [password, setPassword] = useState(hasPreviewDetails ? 'synthetic-password' : '')
  const [busy, setBusy] = useState(preview === 'loading')
  const [err, setErr] = useState<string | null>(() => {
    if (preview === 'validation') return 'Give your team a name.'
    if (preview === 'error') return 'We couldn’t create your account. Check your details and try again.'
    return null
  })
  const [sent, setSent] = useState(preview === 'sent')
  const [previewSimulation, setPreviewSimulation] = useState<string | null>(null)
  const creating = useRef(false)

  const validSlug = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)
  const signedIn = !!session || preview === 'signed-in'
  const signedInEmail = session?.user.email ?? (preview === 'signed-in' ? 'alex@example.com' : '')

  // Live availability check (anon can read tenant slugs by design).
  useEffect(() => {
    if (preview) return
    setAvailable(null)
    if (!validSlug) return
    const t = setTimeout(() => {
      checkSlugAvailable(slug).then(setAvailable).catch(() => setAvailable(null))
    }, 400)
    return () => clearTimeout(t)
  }, [preview, slug, validSlug])

  async function finishCreate(details: { name: string; slug: string }) {
    if (creating.current) return
    creating.current = true
    setBusy(true)
    if (preview) {
      setBusy(false)
      setPreviewSimulation(`Team creation for ${details.name} was simulated locally.`)
      creating.current = false
      return
    }
    try {
      await createTeam(details.name, details.slug)
      sessionStorage.removeItem(PENDING_KEY)
      navigate(`/t/${details.slug}/onboard`)
    } catch (e) {
      const error = e as { code?: string; message?: string }
      creating.current = false
      setBusy(false)
      setErr(error.code === '23505' ? 'That team link is taken — try another.' : (error.message ?? String(e)))
    }
  }

  // Once signed in (password sign-up, or returning from the emailed link),
  // finish creating the team from the stashed pending details.
  useEffect(() => {
    if (preview || !session || creating.current) return
    let details = pending
    if (!details && name.trim() && validSlug) details = { name: name.trim(), slug }
    if (!details) return
    queueMicrotask(() => { void finishCreate(details) })
  }, [preview, session])

  function goTo(destination: string) {
    if (preview) {
      setPreviewSimulation(`Navigation to ${destination} was simulated locally.`)
      return
    }
    navigate(destination)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setPreviewSimulation(null)
    if (!name.trim()) return setErr('Give your team a name.')
    if (!validSlug) return setErr('Team link: 3–40 chars, lowercase letters, numbers and dashes.')
    if (available === false) return setErr('That team link is taken — try another.')
    if (!preview) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name: name.trim(), slug }))
      sessionStorage.setItem('crewlist_auth_return', '/join')
    }

    if (signedIn) {
      await finishCreate({ name: name.trim(), slug })
      return
    }

    if (password.length < 8) return setErr('Use at least 8 characters for your password.')
    if (preview) {
      setSent(true)
      return
    }

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: appUrl(),
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
    <ClAuthShell
      onBrand={() => goTo('/join')}
      preview={preview ? `Synthetic ${preview.replace('-', ' ')} state. No account or team will be created.` : undefined}
      previewTitle="Step 3B preview"
      action={<ClButton variant="secondary" size="small" onClick={() => goTo('/login')}>Sign in</ClButton>}
    >
      <nav className="cl-account-switch" aria-label="Account access">
        <button type="button" aria-current="page" onClick={() => goTo('/join')}>Start a new team</button>
        <button type="button" onClick={() => goTo('/login')}>I have an account</button>
      </nav>

      <div className="cl-auth-heading">
        <p className="cl-eyebrow">NEW TEAM</p>
        <h1>Create your team</h1>
      </div>

      {previewSimulation && (
        <div className="cl-join-simulation">
          <ClNotice tone="success" title="Preview only">{previewSimulation}</ClNotice>
        </div>
      )}

      {sent ? (
        <div className="cl-auth-stack">
          <ClNotice tone="success" title="Check your email">
            We sent a link to <strong className="cl-auth-email">{email}</strong>. Open it in this same browser — you’ll come straight back here and <strong>{name}</strong> will be created automatically.
          </ClNotice>
          <ClButton variant="secondary" full onClick={() => { setSent(false); setBusy(false) }}>Use a different email</ClButton>
        </div>
      ) : (
        <form onSubmit={submit} className="cl-auth-form">
          <ClInput
            id="boat"
            label="Boat / team name"
            required
            maxLength={60}
            value={name}
            onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }}
          />

          <div className="cl-team-link">
            <div className="cl-team-link__top">
              <span className="cl-team-link__address">
                {window.location.host}{new URL(appUrl()).pathname}t/<strong>{slug || '…'}</strong>
              </span>
              {validSlug && available === null && <ClStatus label="Checking team link">Checking…</ClStatus>}
              {validSlug && available === true && <ClStatus tone="open">Available</ClStatus>}
              {validSlug && available === false && <ClStatus tone="danger">Taken</ClStatus>}
            </div>
            <p>This is the link your crew will bookmark. It can’t be changed later.</p>
            <ClButton variant="text" size="small" onClick={() => {
              const next = window.prompt('Customise your team link (lowercase, dashes):', slug)
              if (next !== null) { setSlug(slugify(next)); setSlugTouched(true) }
            }}>
              Customise link
            </ClButton>
          </div>

          {!signedIn && (
            <>
              <ClInput id="fullname" label="Your name" optional placeholder="e.g. Marco Bellini" value={fullName} onChange={e => setFullName(e.target.value)} />
              <ClInput id="email" label="Email" type="email" required autoComplete="email" placeholder="you@boat.com" value={email} onChange={e => setEmail(e.target.value)} />
              <ClInput
                id="password"
                label="Password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                hint="Use at least 8 characters. We’ll email you a confirmation link before creating the team."
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </>
          )}
          {signedIn && (
            <p className="cl-signed-in-note">Signed in as <strong>{signedInEmail}</strong> — select Create team and you’re done.</p>
          )}

          {err && <ClNotice tone="error" title="Check your details">{err}</ClNotice>}
          <ClButton full disabled={busy} loading={busy} type="submit">
            {busy ? 'Working…' : 'Create team →'}
          </ClButton>
          <p className="cl-form-footnote">No approval step — your team is live immediately.</p>
        </form>
      )}
    </ClAuthShell>
  )
}
