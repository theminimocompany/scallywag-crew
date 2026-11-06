import { useEffect, useState } from 'react'
import { navigate } from '@/lib/hash'
import { Spinner, ErrorBox } from '@/components/bits'
import { ConsoleChrome, StatusChip } from '@/components/ConsoleChrome'
import {
  isSuperAdmin, fetchConsoleTeams, fetchCounts, billingLabel,
  type ConsoleTeam,
  errText,
} from '@/lib/consoleApi'

interface Counts { crew: Record<string, number>; races: Record<string, number>; signups: Record<string, number> }

export default function ConsoleTeams({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [teams, setTeams] = useState<ConsoleTeam[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setErr(null)
    try {
      const ok = await isSuperAdmin()
      setAllowed(ok)
      if (!ok) return
      const [t, crew, races, signups] = await Promise.all([
        fetchConsoleTeams(), fetchCounts('crew'), fetchCounts('races'), fetchCounts('signups'),
      ])
      setTeams(t)
      setCounts({ crew, races, signups })
    } catch (e) {
      setErr(errText(e))
    }
  }
  useEffect(() => { load() }, [])

  const totalSignups = counts ? Object.values(counts.signups).reduce((a, b) => a + b, 0) : 0

  function billingCell(t: ConsoleTeam) {
    const b = billingLabel(t)
    const color = b.tone === 'warn' ? '#92400e' : b.tone === 'owner' ? 'hsl(var(--royal))' : 'hsl(var(--slate))'
    const style: React.CSSProperties = b.tone === 'owner'
      ? { border: '1px solid hsl(var(--royal))', borderRadius: 999, padding: '2px 10px' }
      : b.tone === 'warn'
        ? { background: '#fef3c7', borderRadius: 999, padding: '3px 10px' }
        : {}
    return <span className="text-xs font-medium" style={{ color, ...style }}>{b.text}</span>
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <ConsoleChrome email={email} onSignOut={onSignOut} />
      <main className="page page-wide flex-1 py-8 fade-in">
        <h1 className="font-semibold" style={{ fontSize: 24 }}>Crewlist console</h1>
        <p className="text-sm mt-0.5 mb-6" style={{ color: 'hsl(var(--slate))' }}>
          All teams at a glance. Only your account can see this page.
        </p>

        {allowed === null && !err && <Spinner label="Checking access…" />}
        {err && <ErrorBox message={err} onRetry={load} />}
        {allowed === false && (
          <div className="panel p-8 text-center">
            <p className="font-medium">This page is only for the Crewlist owner.</p>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
              Signed in as {email}. If you admin a team, use its admin page instead.
            </p>
            <button className="btn-ghost mt-4" onClick={() => navigate('/t/scallywag/admin')}>Go to team admin</button>
          </div>
        )}

        {allowed && teams && counts && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                [teams.length, 'Teams'],
                [teams.filter(t => t.status === 'active').length, 'Active'],
                [teams.filter(t => t.status === 'suspended').length, 'Suspended'],
                [totalSignups.toLocaleString(), 'Total sign-ups'],
              ].map(([n, label]) => (
                <div key={String(label)} className="panel p-4">
                  <div className="font-semibold" style={{ fontSize: 26 }}>{n}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--slate))' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* desktop table */}
            <div className="panel hidden md:block overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="hairline-b text-left">
                    {['Team', 'Admins', 'Crew', 'Races', 'Sign-ups', 'Billing', 'Status', ''].map(h => (
                      <th key={h} className="uppercase font-medium" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: 'hsl(var(--slate))', padding: '12px 14px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => (
                    <tr key={t.id} className="hairline-b">
                      <td style={{ padding: '12px 14px' }}>
                        <button className="font-semibold cursor-pointer text-left" style={{ color: 'hsl(var(--ink))' }} onClick={() => navigate(`/console/${t.id}`)}>
                          {t.name}
                        </button>
                        <div className="text-xs" style={{ color: 'hsl(var(--slate))' }}>/t/{t.slug}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>{t.tenant_members[0]?.count ?? 0}</td>
                      <td style={{ padding: '12px 14px' }}>{counts.crew[t.id] ?? 0}</td>
                      <td style={{ padding: '12px 14px' }}>{counts.races[t.id] ?? 0}</td>
                      <td style={{ padding: '12px 14px' }}>{counts.signups[t.id] ?? 0}</td>
                      <td style={{ padding: '12px 14px' }}>{billingCell(t)}</td>
                      <td style={{ padding: '12px 14px' }}><StatusChip status={t.status} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--royal))', minHeight: 44 }} onClick={() => navigate(`/console/${t.id}`)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="md:hidden space-y-3">
              {teams.map(t => (
                <button key={t.id} className="panel p-4 w-full text-left cursor-pointer" onClick={() => navigate(`/console/${t.id}`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <StatusChip status={t.status} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--slate))' }}>/t/{t.slug}</div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span>{counts.crew[t.id] ?? 0} crew</span>
                    <span>{counts.races[t.id] ?? 0} races</span>
                    <span>{counts.signups[t.id] ?? 0} sign-ups</span>
                  </div>
                  <div className="mt-2">{billingCell(t)}</div>
                </button>
              ))}
            </div>

            <p className="text-xs mt-4" style={{ color: 'hsl(var(--slate))' }}>
              New teams appear here the moment they sign up — no approval step. Auto-suspend only applies to teams
              whose set paid-until date has passed (never to unbilled teams).
            </p>
          </>
        )}
      </main>
    </div>
  )
}
