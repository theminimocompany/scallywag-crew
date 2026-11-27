import { useEffect, useState } from 'react'
import { navigate } from '@/lib/hash'
import { ConsoleChrome, StatusChip } from '@/components/ConsoleChrome'
import {
  ClButton,
  ClEmpty,
  ClNotice,
  ClSkeleton,
} from '@/components/CrewlistUI'
import {
  isSuperAdmin, fetchConsoleTeams, fetchCounts, superListAdmins,
  superSetStatus, superSetBilling, superAddSelfAdmin,
  type ConsoleTeam, type ConsoleAdmin, type BillingPlan,
  errText,
} from '@/lib/consoleApi'

export type ConsoleTeamPreview = 'ready' | 'loading' | 'error' | 'denied' | 'confirm' | 'notice' | 'busy'

const previewTeam: ConsoleTeam = {
  id: 'preview-sea-wolf', slug: 'sea-wolf', name: 'Sea Wolf', status: 'active', created_at: '2026-09-18T00:00:00Z',
  tenant_billing: { plan: 'paid', paid_until: '2027-06-30', created_by_email: 'owner@example.com' },
  tenant_members: [{ count: 2 }],
}
const previewAdmins: ConsoleAdmin[] = [
  { user_id: 'preview-owner', email: 'owner@example.com' },
  { user_id: 'preview-organiser', email: 'organiser@example.com' },
]

export default function ConsoleTeamDetail({
  teamId,
  email,
  onSignOut,
  preview,
}: {
  teamId: string
  email: string
  onSignOut: () => void
  preview?: ConsoleTeamPreview
}) {
  const hasPreviewData = preview === 'ready' || preview === 'confirm' || preview === 'notice' || preview === 'busy'
  const [allowed, setAllowed] = useState<boolean | null>(preview === 'denied' ? false : hasPreviewData ? true : null)
  const [team, setTeam] = useState<ConsoleTeam | null>(hasPreviewData ? { ...previewTeam } : null)
  const [counts, setCounts] = useState<{ crew: number; races: number; signups: number } | null>(hasPreviewData ? { crew: 24, races: 8, signups: 86 } : null)
  const [admins, setAdmins] = useState<ConsoleAdmin[] | null>(hasPreviewData ? previewAdmins : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic connection failure for this preview.' : null)
  const [plan, setPlan] = useState<BillingPlan>(hasPreviewData ? 'paid' : 'free')
  const [paidUntil, setPaidUntil] = useState(hasPreviewData ? '2027-06-30' : '')
  const [busy, setBusy] = useState(preview === 'busy')
  const [notice, setNotice] = useState<string | null>(preview === 'notice' ? 'Billing saved in this synthetic preview. No database request was made.' : null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [confirmSuspend, setConfirmSuspend] = useState(preview === 'confirm')

  async function load() {
    setErr(null)
    if (preview) {
      setAllowed(true)
      setTeam({ ...previewTeam })
      setCounts({ crew: 24, races: 8, signups: 86 })
      setAdmins(previewAdmins)
      setPlan('paid')
      setPaidUntil('2027-06-30')
      setBusy(false)
      setNotice(null)
      setActionErr(null)
      setConfirmSuspend(false)
      return
    }
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
      setErr(errText(e))
    }
  }
  useEffect(() => {
    if (preview) return
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [teamId, preview])

  async function run(fn: () => Promise<void>, message: string, onPreview?: () => void) {
    setBusy(true); setActionErr(null); setNotice(null)
    try {
      if (preview) {
        onPreview?.()
      } else {
        await fn()
        await load()
      }
      setNotice(preview ? `${message} Preview only; no database request was made.` : message)
      setConfirmSuspend(false)
    } catch (e) {
      setActionErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const suspended = team?.status === 'suspended'

  return (
    <div className="cl-root cl-console">
      <ConsoleChrome email={email} onSignOut={onSignOut} preview={!!preview} />
      <main className="cl-container cl-container--marketing cl-console-main">
        {preview && (
          <div className="cl-console-preview-notice">
            <ClNotice title="Synthetic team preview">All team details are fictional. Actions below change only this browser preview.</ClNotice>
          </div>
        )}
        {allowed === null && !err && <div className="cl-console-state"><ClSkeleton rows={3} label="Checking console access" /></div>}
        {err && (
          <div className="cl-console-state">
            <ClNotice tone="error" title="Team unavailable" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice>
          </div>
        )}
        {allowed === false && (
          <div className="cl-panel cl-console-state">
            <ClEmpty title="This page is only for the Crewlist owner" />
          </div>
        )}

        {allowed && team && counts && (
          <>
            <ClButton
              variant="text"
              className="cl-console-back"
              onClick={() => navigate(preview ? '/mockups/console' : '/console')}
            >
              ← All teams
            </ClButton>
            <div className="cl-console-team-heading">
              <div>
                <p className="cl-eyebrow">Team administration</p>
                <div className="cl-console-team-heading__title"><h1>{team.name}</h1><StatusChip status={team.status} /></div>
                <p className="cl-console-team-heading__meta">
                  /t/{team.slug} · created {team.created_at.slice(0, 10)}
                  {team.tenant_billing?.created_by_email ? ` by ${team.tenant_billing.created_by_email}` : ''}
                </p>
              </div>
            </div>

            <dl className="cl-console-metrics" aria-label="Team summary">
              {[[counts.crew, 'Crew'], [counts.races, 'Races'], [counts.signups, 'Sign-ups'], [admins?.length ?? 0, 'Admins']].map(([n, label]) => (
                <div key={String(label)} className="cl-panel cl-console-metric">
                  <dt>{label}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>

            {(notice || actionErr) && (
              <div className="cl-console-action-notice">
                {notice && <ClNotice tone="success" title="Action completed">{notice}</ClNotice>}
                {actionErr && <ClNotice tone="error" title="Action failed">{actionErr}</ClNotice>}
              </div>
            )}

            <div className="cl-console-detail-grid">
              <div className="cl-console-detail-main">
                <section className="cl-panel cl-console-section" aria-labelledby="console-billing-heading">
                  <div className="cl-panel__header">
                    <h2 id="console-billing-heading">Manual billing</h2>
                    <span className="cl-console-section__meta">HK$300 / year</span>
                  </div>
                  <div className="cl-panel__body cl-console-form">
                    <div className="cl-field">
                      <label className="cl-label" htmlFor="plan">Plan</label>
                      <select id="plan" className="cl-input" value={plan} disabled={busy} onChange={e => setPlan(e.target.value as BillingPlan)}>
                        <option value="free">Free</option>
                        <option value="paid">Paid (manual)</option>
                        <option value="owner">Owner — exempt forever</option>
                      </select>
                    </div>
                    <div className="cl-field">
                      <label className="cl-label" htmlFor="paid-until">Paid until</label>
                      <input id="paid-until" className="cl-input cl-mono" type="date" value={paidUntil} disabled={busy} onChange={e => setPaidUntil(e.target.value)} />
                    </div>
                    <p className="cl-console-help">
                      Set this after the team pays you by FPS / PayMe / bank transfer. Expiry → 14-day grace → automatic
                      suspend. Leave paid-until empty and the team is never auto-suspended. Stripe later updates this same field.
                    </p>
                    <ClButton
                      full
                      loading={busy}
                      onClick={() => run(
                        () => superSetBilling(team.id, plan, paidUntil || null),
                        'Billing saved.',
                        () => setTeam(current => current ? { ...current, tenant_billing: { plan, paid_until: paidUntil || null, created_by_email: current.tenant_billing?.created_by_email ?? null } } : current),
                      )}
                    >
                      Save billing
                    </ClButton>
                  </div>
                </section>

                <section className="cl-console-section" aria-labelledby="console-admins-heading">
                  <div className="cl-console-section-heading">
                    <h2 id="console-admins-heading">Admins</h2>
                    <span>{admins?.length ?? 0} of 4 places used</span>
                  </div>
                  <div className="cl-panel cl-console-admin-list">
                    {(admins ?? []).map(a => (
                      <div key={a.user_id} className="cl-console-admin-row">
                        <span>{a.email}</span>
                        {a.email === email && <span className="cl-console-you">you</span>}
                      </div>
                    ))}
                    {admins && admins.length === 0 && <p className="cl-console-admin-empty">No admins yet.</p>}
                  </div>
                </section>
              </div>

              <section className="cl-console-actions" aria-labelledby="console-actions-heading">
                <div className="cl-console-section-heading">
                  <h2 id="console-actions-heading">Actions</h2>
                </div>
                <div className="cl-panel cl-panel__body cl-console-action-list">
                  <ClButton variant="secondary" full onClick={() => navigate(preview ? '/mockups/schedule' : `/t/${team.slug}/schedule`)}>
                    View public page
                  </ClButton>
                  <ClButton
                    variant="secondary"
                    full
                    disabled={busy}
                    onClick={() => run(
                      () => superAddSelfAdmin(team.id),
                      `You are now an admin of ${team.name}.`,
                      () => setAdmins(current => current?.some(a => a.email === email) ? current : [...(current ?? []), { user_id: 'preview-self', email }]),
                    )}
                  >
                    Add myself as admin
                  </ClButton>
                  {(admins?.some(a => a.email === email) || preview) && (
                    <ClButton variant="secondary" full onClick={() => navigate(preview ? '/mockups/admin' : `/t/${team.slug}/admin`)}>
                      Open {team.name} admin →
                    </ClButton>
                  )}
                  {!confirmSuspend ? (
                    <ClButton
                      variant={suspended ? 'primary' : 'danger'}
                      full
                      disabled={busy}
                      onClick={() => { setConfirmSuspend(true); setNotice(null); setActionErr(null) }}
                    >
                      {suspended ? 'Reactivate team' : 'Suspend team'}
                    </ClButton>
                  ) : (
                    <div className="cl-console-suspend-confirm" role="alert">
                      <p>
                        {suspended
                          ? 'Reactivate restores public pages and admin access immediately. No data was touched.'
                          : 'Suspension hides public pages with a neutral notice. Races, crew and sign-ups are fully retained. Reactivate any time.'}
                      </p>
                      <ClButton
                        variant={suspended ? 'primary' : 'danger'}
                        full
                        loading={busy}
                        onClick={() => run(
                          () => superSetStatus(team.id, suspended ? 'active' : 'suspended'),
                          suspended ? 'Team reactivated.' : 'Team suspended.',
                          () => setTeam(current => current ? { ...current, status: suspended ? 'active' : 'suspended' } : current),
                        )}
                      >
                        {suspended ? 'Confirm reactivate' : 'Confirm suspend'}
                      </ClButton>
                      <ClButton variant="ghost" full disabled={busy} onClick={() => setConfirmSuspend(false)}>Cancel</ClButton>
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
