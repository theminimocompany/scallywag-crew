import { useEffect, useState } from 'react'
import { navigate } from '@/lib/hash'
import { Spinner, ErrorBox, ErrText } from '@/components/bits'
import { ConsoleChrome, StatusChip } from '@/components/ConsoleChrome'
import {
  isSuperAdmin, fetchConsoleTeams, fetchCounts, superListAdmins,
  superSetStatus, superSetBilling, superAddSelfAdmin,
  type ConsoleTeam, type ConsoleAdmin, type BillingPlan,
} from '@/lib/consoleApi'

export default function ConsoleTeamDetail({ teamId, email, onSignOut }: { teamId: string; email: string; onSignOut: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [team, setTeam] = useState<ConsoleTeam | null>(null)
  const [counts, setCounts] = useState<{ crew: number; races: number; signups: number } | null>(null)
  const [admins, setAdmins] = useState<ConsoleAdmin[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [plan, setPlan] = useState<BillingPlan>('free')
  const [paidUntil, setPaidUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  async function load() {
    setErr(null)
    try {
      const ok = await isSuperAdmin()
      setAllowed(ok)
      if (!ok) return
      const [teams, crew, races, signups, adminRows] = await Promise.all([
        fetchConsoleTeams(), fetchCounts('crew'), fetchCounts('races'), fetchCounts('signups'),
        superListAdmins(teamId),
      ])
      const t = teams.find(x => x.id === teamId)
      if (!t) { setErr('Team not found.'); return }
      setTeam(t)
      setCounts({ crew: crew[teamId] ?? 0, races: races[teamId] ?? 0, signups: signups[teamId] ?? 0 })
      setAdmins(adminRows)
      setPlan(t.tenant_billing?.plan ?? 'free')
      setPaidUntil(t.tenant_billing?.paid_until ?? '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => { load() }, [teamId])

  async function run(fn: () => Promise<void>, message: string) {
    setBusy(true); setActionErr(null); setNotice(null)
    try {
      await fn()
      setNotice(message)
      setConfirmSuspend(false)
      await load()
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const suspended = team?.status === 'suspended'

  return (
    <div className="min-h-100dvh flex flex-col">
      <ConsoleChrome email={email} onSignOut={onSignOut} />
      <main className="page page-wide flex-1 py-8 fade-in">
        {allowed === null && !err && <Spinner label="Checking access…" />}
        {err && <ErrorBox message={err} onRetry={load} />}
        {allowed === false && (
          <div className="panel p-8 text-center">
            <p className="font-medium">This page is only for the Crewlist owner.</p>
          </div>
        )}

        {allowed && team && counts && (
          <>
            <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--slate))', minHeight: 44 }} onClick={() => navigate('/console')}>
              ← All teams
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-semibold" style={{ fontSize: 24 }}>{team.name}</h1>
              <StatusChip status={team.status} />
            </div>
            <p className="text-sm mt-0.5 mb-6" style={{ color: 'hsl(var(--slate))' }}>
              /t/{team.slug} · created {team.created_at.slice(0, 10)}
              {team.tenant_billing?.created_by_email ? ` by ${team.tenant_billing.created_by_email}` : ''}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[[counts.crew, 'Crew'], [counts.races, 'Races'], [counts.signups, 'Sign-ups'], [admins?.length ?? 0, 'Admins']].map(([n, label]) => (
                <div key={String(label)} className="panel p-4">
                  <div className="font-semibold" style={{ fontSize: 26 }}>{n}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--slate))' }}>{label}</div>
                </div>
              ))}
            </div>

            {(notice || actionErr) && (
              <div className="mb-4">
                {notice && <p className="text-sm font-medium" role="status" style={{ color: '#166534' }}>{notice}</p>}
                {actionErr && <ErrText>{actionErr}</ErrText>}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-5 items-start">
              <div className="md:col-span-2 space-y-5">
                {/* manual billing */}
                <section className="panel p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Manual billing</h2>
                    <span className="text-xs uppercase font-medium" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>HK$300 / year</span>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }} htmlFor="plan">Plan</label>
                    <select id="plan" className="input" value={plan} onChange={e => setPlan(e.target.value as BillingPlan)}>
                      <option value="free">Free</option>
                      <option value="paid">Paid (manual)</option>
                      <option value="owner">Owner — exempt forever</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }} htmlFor="paid-until">Paid until</label>
                    <input id="paid-until" className="input" type="date" value={paidUntil} onChange={e => setPaidUntil(e.target.value)} />
                  </div>
                  <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                    Set this after the team pays you by FPS / PayMe / bank transfer. Expiry → 14-day grace → automatic
                    suspend. Leave paid-until empty and the team is never auto-suspended. Stripe later updates this same field.
                  </p>
                  <button
                    className="btn-primary w-full" disabled={busy}
                    onClick={() => run(() => superSetBilling(team.id, plan, paidUntil || null), 'Billing saved.')}
                  >
                    Save billing
                  </button>
                </section>

                {/* admins */}
                <section>
                  <h2 className="text-xs uppercase font-medium mb-2" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Admins</h2>
                  <div className="panel divide-y divide-[hsl(var(--frost))]">
                    {(admins ?? []).map(a => (
                      <div key={a.user_id} className="flex items-center justify-between p-4">
                        <span className="text-sm font-medium break-all">{a.email}</span>
                        {a.email === email && <span className="text-xs" style={{ color: 'hsl(var(--slate))' }}>you</span>}
                      </div>
                    ))}
                    {admins && admins.length === 0 && <p className="p-4 text-sm" style={{ color: 'hsl(var(--slate))' }}>No admins yet.</p>}
                  </div>
                </section>
              </div>

              {/* actions */}
              <section>
                <h2 className="text-xs uppercase font-medium mb-2" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Actions</h2>
                <div className="panel p-4 space-y-2">
                  <button className="btn-ghost w-full" onClick={() => navigate(`/t/${team.slug}/schedule`)}>
                    View public page
                  </button>
                  <button
                    className="btn-ghost w-full" disabled={busy}
                    onClick={() => run(() => superAddSelfAdmin(team.id), `You are now an admin of ${team.name}.`)}
                  >
                    Add myself as admin
                  </button>
                  {admins?.some(a => a.email === email) && (
                    <button className="btn-ghost w-full" onClick={() => navigate(`/t/${team.slug}/admin`)}>
                      Open {team.name} admin →
                    </button>
                  )}
                  {!confirmSuspend ? (
                    <button
                      className="btn-ghost w-full font-semibold"
                      style={{ color: suspended ? '#166534' : 'hsl(var(--destructive))' }}
                      onClick={() => setConfirmSuspend(true)}
                    >
                      {suspended ? 'Reactivate team' : 'Suspend team'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                        {suspended
                          ? 'Reactivate restores public pages and admin access immediately. No data was touched.'
                          : 'Suspension hides public pages with a neutral notice. Races, crew and sign-ups are fully retained. Reactivate any time.'}
                      </p>
                      <button
                        className="btn-primary w-full" disabled={busy}
                        style={suspended ? undefined : { background: 'hsl(var(--destructive))' }}
                        onClick={() => run(
                          () => superSetStatus(team.id, suspended ? 'active' : 'suspended'),
                          suspended ? 'Team reactivated.' : 'Team suspended.',
                        )}
                      >
                        {suspended ? 'Confirm reactivate' : 'Confirm suspend'}
                      </button>
                      <button className="btn-ghost w-full" onClick={() => setConfirmSuspend(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
