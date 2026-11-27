import { useEffect, useState } from 'react'
import { navigate } from '@/lib/hash'
import { ConsoleChrome, StatusChip } from '@/components/ConsoleChrome'
import {
  ClButton,
  ClEmpty,
  ClNotice,
  ClPageHeader,
  ClSkeleton,
  ClStatus,
} from '@/components/CrewlistUI'
import {
  isSuperAdmin, fetchConsoleTeams, fetchCounts, billingLabel,
  type ConsoleTeam,
  errText,
} from '@/lib/consoleApi'

interface Counts { crew: Record<string, number>; races: Record<string, number>; signups: Record<string, number> }
export type ConsoleTeamsPreview = 'ready' | 'loading' | 'error' | 'denied' | 'empty'

const previewTeams: ConsoleTeam[] = [
  {
    id: 'preview-sea-wolf', slug: 'sea-wolf', name: 'Sea Wolf', status: 'active', created_at: '2026-09-18T00:00:00Z',
    tenant_billing: { plan: 'paid', paid_until: '2027-06-30', created_by_email: 'owner@example.com' },
    tenant_members: [{ count: 2 }],
  },
  {
    id: 'preview-bluefin', slug: 'bluefin', name: 'Bluefin', status: 'active', created_at: '2026-08-02T00:00:00Z',
    tenant_billing: { plan: 'owner', paid_until: null, created_by_email: 'owner@example.com' },
    tenant_members: [{ count: 3 }],
  },
  {
    id: 'preview-night-train', slug: 'night-train', name: 'Night Train', status: 'suspended', created_at: '2026-10-11T00:00:00Z',
    tenant_billing: { plan: 'free', paid_until: null, created_by_email: 'organiser@example.com' },
    tenant_members: [{ count: 1 }],
  },
  {
    id: 'preview-harbour-cats', slug: 'harbour-cats', name: 'Harbour Cats', status: 'past_due', created_at: '2026-07-23T00:00:00Z',
    tenant_billing: { plan: 'paid', paid_until: '2026-10-31', created_by_email: 'organiser@example.com' },
    tenant_members: [{ count: 4 }],
  },
]

const previewCounts: Counts = {
  crew: { 'preview-sea-wolf': 24, 'preview-bluefin': 18, 'preview-night-train': 12, 'preview-harbour-cats': 31 },
  races: { 'preview-sea-wolf': 8, 'preview-bluefin': 14, 'preview-night-train': 3, 'preview-harbour-cats': 11 },
  signups: { 'preview-sea-wolf': 86, 'preview-bluefin': 132, 'preview-night-train': 19, 'preview-harbour-cats': 74 },
}

export default function ConsoleTeams({
  email,
  onSignOut,
  preview,
}: {
  email: string
  onSignOut: () => void
  preview?: ConsoleTeamsPreview
}) {
  const hasPreviewData = preview === 'ready' || preview === 'empty'
  const [allowed, setAllowed] = useState<boolean | null>(preview === 'denied' ? false : hasPreviewData ? true : null)
  const [teams, setTeams] = useState<ConsoleTeam[] | null>(hasPreviewData ? (preview === 'empty' ? [] : previewTeams) : null)
  const [counts, setCounts] = useState<Counts | null>(hasPreviewData ? previewCounts : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic connection failure for this preview.' : null)

  async function load() {
    setErr(null)
    if (preview) {
      setAllowed(true)
      setTeams(preview === 'empty' ? [] : previewTeams)
      setCounts(previewCounts)
      return
    }
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
  useEffect(() => {
    if (preview) return
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [preview])

  const totalSignups = counts ? Object.values(counts.signups).reduce((a, b) => a + b, 0) : 0

  function billingCell(t: ConsoleTeam) {
    const b = billingLabel(t)
    const tone = b.tone === 'warn' ? 'warning' : b.tone === 'owner' ? 'selected' : b.tone === 'ok' ? 'open' : 'neutral'
    return <ClStatus tone={tone}>{b.text}</ClStatus>
  }

  function openTeam(id: string) {
    navigate(preview ? '/mockups/console/team' : `/console/${id}`)
  }

  return (
    <div className="cl-root cl-console">
      <ConsoleChrome email={email} onSignOut={onSignOut} preview={!!preview} />
      <main className="cl-container cl-container--marketing cl-console-main">
        {preview && (
          <div className="cl-console-preview-notice">
            <ClNotice title="Synthetic console preview">All teams and counts are fictional. No Auth, tenant reads or database writes are used.</ClNotice>
          </div>
        )}
        <ClPageHeader
          eyebrow="Owner console"
          title="Crewlist console"
          description="All teams at a glance. Only your account can see this page."
        />

        {allowed === null && !err && <div className="cl-console-state"><ClSkeleton rows={3} label="Checking console access" /></div>}
        {err && (
          <div className="cl-console-state">
            <ClNotice tone="error" title="Console unavailable" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice>
          </div>
        )}
        {allowed === false && (
          <div className="cl-panel cl-console-state">
            <ClEmpty
              title="This page is only for the Crewlist owner"
              hint={`Signed in as ${email}. If you admin a team, use its admin page instead.`}
              action={<ClButton variant="secondary" onClick={() => navigate(preview ? '/mockups/onboarding/account' : '/login')}>Go to my account</ClButton>}
            />
          </div>
        )}

        {allowed && teams && counts && (
          <>
            <dl className="cl-console-metrics" aria-label="Console summary">
              {[
                [teams.length, 'Teams'],
                [teams.filter(t => t.status === 'active').length, 'Active'],
                [teams.filter(t => t.status === 'suspended').length, 'Suspended'],
                [totalSignups.toLocaleString(), 'Total sign-ups'],
              ].map(([n, label]) => (
                <div key={String(label)} className="cl-panel cl-console-metric">
                  <dt>{label}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>

            {teams.length === 0 ? (
              <div className="cl-panel">
                <ClEmpty title="No teams yet" hint="New teams appear here as soon as they complete registration." />
              </div>
            ) : (
              <>
                <div className="cl-panel cl-console-table-wrap">
                  <table className="cl-console-table">
                    <thead>
                      <tr>
                        {['Team', 'Admins', 'Crew', 'Races', 'Sign-ups', 'Billing', 'Status', ''].map(h => <th key={h} scope="col">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map(t => (
                        <tr key={t.id}>
                          <td>
                            <button type="button" className="cl-console-team-link" onClick={() => openTeam(t.id)}>{t.name}</button>
                            <span className="cl-console-team-slug">/t/{t.slug}</span>
                          </td>
                          <td className="cl-mono">{t.tenant_members[0]?.count ?? 0}</td>
                          <td className="cl-mono">{counts.crew[t.id] ?? 0}</td>
                          <td className="cl-mono">{counts.races[t.id] ?? 0}</td>
                          <td className="cl-mono">{counts.signups[t.id] ?? 0}</td>
                          <td>{billingCell(t)}</td>
                          <td><StatusChip status={t.status} /></td>
                          <td><ClButton variant="text" onClick={() => openTeam(t.id)}>Open</ClButton></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="cl-console-team-cards">
                  {teams.map(t => (
                    <button type="button" key={t.id} className="cl-panel cl-console-team-card" onClick={() => openTeam(t.id)}>
                      <span className="cl-console-team-card__top"><strong>{t.name}</strong><StatusChip status={t.status} /></span>
                      <span className="cl-console-team-slug">/t/{t.slug}</span>
                      <span className="cl-console-team-card__counts">
                        <span><b className="cl-mono">{counts.crew[t.id] ?? 0}</b> crew</span>
                        <span><b className="cl-mono">{counts.races[t.id] ?? 0}</b> races</span>
                        <span><b className="cl-mono">{counts.signups[t.id] ?? 0}</b> sign-ups</span>
                      </span>
                      <span className="cl-console-team-card__billing">{billingCell(t)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="cl-console-footnote">
              New teams appear here the moment they sign up — no approval step. Auto-suspend only applies to teams
              whose set paid-until date has passed (never to unbilled teams).
            </p>
          </>
        )}
      </main>
    </div>
  )
}
