import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useHash, segments, navigate } from '@/lib/hash'
import { TENANT_SLUG, TEAM_NAME } from '@/lib/config'
import { AdminHeader } from '@/components/chrome'
import { Spinner } from '@/components/bits'
import PublicSchedule from '@/pages/PublicSchedule'
import PublicSignup from '@/pages/PublicSignup'
import AdminLogin from '@/pages/AdminLogin'
import AdminRaces from '@/pages/AdminRaces'
import AdminRaceDetail from '@/pages/AdminRaceDetail'
import AdminRoster from '@/pages/AdminRoster'
import AdminImport from '@/pages/AdminImport'
import AdminSettings from '@/pages/AdminSettings'
import ConsoleTeams from '@/pages/ConsoleTeams'
import ConsoleTeamDetail from '@/pages/ConsoleTeamDetail'
import Join from '@/pages/Join'
import AccountHome from '@/pages/AccountHome'
import Onboard from '@/pages/Onboard'
import { getTenant, clearTenantCache } from '@/lib/api'
import { setTeamName, setTenantSlug } from '@/lib/tenant'

type TenantLoad =
  | { state: 'loading' }
  | { state: 'notfound' }
  | { state: 'ok'; status: string }

export default function App() {
  const hash = useHash()
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [tenantLoad, setTenantLoad] = useState<TenantLoad>({ state: 'loading' })

  useEffect(() => {
    // Arriving via an emailed sign-in link: URL carries ?code=…, supabase-js
    // exchanges it and fires SIGNED_IN — return to whatever needed the login.
    const fromEmailLink = new URLSearchParams(window.location.search).has('code')
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' && fromEmailLink) {
        window.history.replaceState(null, '', window.location.pathname)
        const back = sessionStorage.getItem('crewlist_auth_return')
        sessionStorage.removeItem('crewlist_auth_return')
        navigate(back || `/t/${TENANT_SLUG}/admin`)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const seg = segments(hash)
  const slug = seg[0] === 't' ? seg[1] : null

  // Load whichever team the URL points at (multi-tenant).
  useEffect(() => {
    if (!slug) return
    setTenantSlug(slug)
    clearTenantCache()
    setTeamName(TEAM_NAME) // fallback wordmark until the real name lands
    setTenantLoad({ state: 'loading' })
    let cancelled = false
    getTenant()
      .then(t => {
        if (cancelled) return
        setTeamName(t.name)
        setTenantLoad({ state: 'ok', status: t.status ?? 'active' })
      })
      .catch(() => { if (!cancelled) setTenantLoad({ state: 'notfound' }) })
    return () => { cancelled = true }
  }, [slug])

  // default route → Scallywag public schedule (the owner's team)
  useEffect(() => {
    if (seg.length === 0) navigate(`/t/${TENANT_SLUG}/schedule`)
  }, [seg.length])

  const signOut = async () => { await supabase.auth.signOut() }
  const center = (node: React.ReactNode) => <div className="min-h-100dvh grid place-content-center">{node}</div>

  // ---- Crewlist console (super admin) ----
  if (seg[0] === 'console') {
    if (!authReady) return center(<Spinner />)
    if (!session) {
      sessionStorage.setItem('crewlist_auth_return', window.location.hash || '#/console')
      return <AdminLogin crewlist />
    }
    const email = session.user.email ?? ''
    return seg[1]
      ? <ConsoleTeamDetail teamId={seg[1]} email={email} onSignOut={signOut} />
      : <ConsoleTeams email={email} onSignOut={signOut} />
  }

  // ---- join / login ----
  if (seg[0] === 'join') {
    if (!authReady) return center(<Spinner />)
    return <Join session={session} />
  }
  if (seg[0] === 'login') {
    if (!authReady) return center(<Spinner />)
    if (!session) {
      sessionStorage.setItem('crewlist_auth_return', '#/login')
      return <AdminLogin crewlist />
    }
    return <AccountHome email={session.user.email ?? ''} />
  }

  // ---- tenant routes: /t/<slug>/... ----
  if (!slug) return center(<Spinner label="Loading Crewlist…" />)
  if (tenantLoad.state === 'loading') return center(<Spinner label="Loading team…" />)
  if (tenantLoad.state === 'notfound') {
    return (
      <main className="page py-16">
        <div className="panel p-8 text-center space-y-2">
          <p className="font-semibold" style={{ fontSize: 20 }}>No team at this address</p>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Check the link you were sent, or start your own team on Crewlist.
          </p>
          <button className="btn-primary mt-2" onClick={() => navigate('/join')}>Go to Crewlist</button>
        </div>
      </main>
    )
  }

  // Suspended teams: neutral notice, data untouched. The owner manages this
  // from the console; there is no self-serve reactivate.
  if (tenantLoad.state === 'ok' && tenantLoad.status === 'suspended') {
    return (
      <main className="page py-16">
        <div className="panel p-8 text-center space-y-2">
          <p className="font-semibold" style={{ fontSize: 20 }}>This team is currently unavailable</p>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Its races, crew and sign-ups are safe. If you admin this team, contact Crewlist to reactivate it.
          </p>
        </div>
      </main>
    )
  }

  const page = seg[2] ?? 'schedule'

  // ---- public ----
  if (page === 'signup') return <PublicSignup />
  if (page === 'schedule') return <PublicSchedule />

  // ---- onboarding wizard (team admin, just created) ----
  if (page === 'onboard') {
    if (!authReady) return center(<Spinner />)
    if (!session) {
      sessionStorage.setItem('crewlist_auth_return', window.location.hash)
      return <AdminLogin crewlist />
    }
    return <Onboard email={session.user.email ?? ''} />
  }

  // ---- admin ----
  if (page === 'admin') {
    if (!authReady) return center(<Spinner />)
    if (!session) return <AdminLogin />
    const sub = seg[3] ?? 'races'
    return (
      <div className="min-h-100dvh flex flex-col">
        <AdminHeader onSignOut={signOut} />
        {sub === 'races' && seg[4] && <AdminRaceDetail raceId={seg[4]} />}
        {sub === 'races' && !seg[4] && <AdminRaces />}
        {sub === 'roster' && <AdminRoster crewId={seg[4]} />}
        {sub === 'import' && <AdminImport />}
        {sub === 'settings' && <AdminSettings />}
        {!['races', 'roster', 'import', 'settings'].includes(sub) && <AdminRaces />}
      </div>
    )
  }

  return <PublicSchedule />
}
