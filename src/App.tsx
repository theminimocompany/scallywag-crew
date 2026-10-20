import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useHash, segments, navigate } from '@/lib/hash'
import { TENANT_SLUG } from '@/lib/config'
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
import { getTenant } from '@/lib/api'
import { setTeamName } from '@/lib/tenant'

export default function App() {
  const hash = useHash()
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    // Arriving via an emailed sign-in link: URL carries ?code=…, supabase-js
    // exchanges it and fires SIGNED_IN — forward that fresh session to admin.
    const fromEmailLink = new URLSearchParams(window.location.search).has('code')
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' && fromEmailLink) {
        window.history.replaceState(null, '', window.location.pathname)
        navigate(`/t/${TENANT_SLUG}/admin`)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // team name comes from the tenants table (editable in Settings)
  useEffect(() => {
    getTenant().then(t => setTeamName(t.name)).catch(() => { /* fallback name stays */ })
  }, [])

  const seg = segments(hash)

  // default route → public schedule
  useEffect(() => {
    if (seg.length === 0) navigate(`/t/${TENANT_SLUG}/schedule`)
  }, [seg.length])

  // everything lives under /t/<slug>/...
  const isTenant = seg[0] === 't' && seg[1] === TENANT_SLUG
  if (!isTenant) {
    return <div className="min-h-100dvh grid place-content-center"><Spinner label="Loading Scallywag…" /></div>
  }

  const page = seg[2] ?? 'schedule'

  // ---- public ----
  if (page === 'signup') return <PublicSignup />
  if (page === 'schedule') return <PublicSchedule />

  // ---- admin ----
  if (page === 'admin') {
    if (!authReady) return <div className="min-h-100dvh grid place-content-center"><Spinner /></div>
    if (!session) return <AdminLogin />
    const sub = seg[3] ?? 'races'
    const signOut = async () => { await supabase.auth.signOut() }
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
