import { useCallback, useEffect, useState } from 'react'
import { fetchSchedule, fmtDate, fmtTime, groupByMonth, type ScheduleRow } from '@/lib/api'
import { navigate } from '@/lib/hash'
import { currentTenantSlug, useTeamName } from '@/lib/tenant'
import { ClButton, ClEmpty, ClNotice, ClPageHeader, ClSkeleton, ClStatus, TeamBrand } from '@/components/CrewlistUI'

const previewRows: ScheduleRow[] = [
  {
    tenant_slug: 'testing101',
    race_id: 'preview-harbour-series',
    race_name: 'Harbour Series · Race 1',
    race_date: '2027-01-09',
    start_time: '09:05',
    location: 'Victoria Harbour',
    selected_crew: ['Alex', 'Morgan', 'Sam'],
  },
  {
    tenant_slug: 'testing101',
    race_id: 'preview-island-race',
    race_name: 'Island Race',
    race_date: '2027-01-23',
    start_time: '10:30',
    location: 'Royal Hong Kong Yacht Club',
    selected_crew: [],
  },
  {
    tenant_slug: 'testing101',
    race_id: 'preview-winter-regatta',
    race_name: 'Winter Regatta',
    race_date: '2027-02-06',
    start_time: '08:45',
    location: 'Middle Island',
    selected_crew: ['Alex', 'Morgan'],
  },
]

function ScheduleDate({ iso }: { iso: string }) {
  const { day, dow } = fmtDate(iso)
  return (
    <time className="cl-schedule-date" dateTime={iso}>
      <strong>{day}</strong>
      <span>{dow}</span>
    </time>
  )
}

export default function PublicSchedule({ preview = false }: { preview?: boolean }) {
  const [rows, setRows] = useState<ScheduleRow[] | null>(preview ? previewRows : null)
  const [err, setErr] = useState<string | null>(null)
  const [previewAction, setPreviewAction] = useState('Synthetic Testing101 data. No live pages or tenant data are used.')
  const liveTeamName = useTeamName()
  const teamName = preview ? 'Testing101' : liveTeamName
  const base = `/t/${currentTenantSlug()}`

  const load = useCallback(() => {
    if (preview) return
    fetchSchedule()
      .then(d => setRows(d.filter(r => r.selected_crew.length > 0 || true)))
      .catch(e => setErr(e.message))
  }, [preview])
  useEffect(load, [load])

  function retry() {
    setErr(null)
    load()
  }

  function go(path: string, destination: 'schedule' | 'signup' | 'admin') {
    if (!preview) {
      navigate(path)
      return
    }
    const messages = {
      schedule: 'You are viewing the Step 2A public-schedule preview.',
      signup: 'The existing signup flow is unchanged and will be restyled in Step 2B.',
      admin: 'Admin is unchanged in Step 2A and will be restyled in a later phase.',
    }
    setPreviewAction(messages[destination])
  }

  return (
    <div className="cl-root cl-public-schedule">
      <header className="cl-public-header">
        <div className="cl-container cl-public-header__inner">
          <button type="button" className="cl-public-brand" onClick={() => go(`${base}/schedule`, 'schedule')} aria-label={`${teamName} home`}>
            <TeamBrand teamName={teamName} />
          </button>
          <ClButton variant="text" size="small" onClick={() => go(`${base}/admin`, 'admin')}>Admin</ClButton>
        </div>
      </header>

      <main className="cl-container cl-schedule-main">
        <ClPageHeader
          eyebrow="PUBLIC RACE SCHEDULE"
          title="Upcoming races"
          description="Selected crew is published here once confirmed. Past races and availability lists are private."
        />

        {preview && (
          <div className="cl-schedule-preview-notice">
            <ClNotice tone="info" title="Step 2A preview">{previewAction}</ClNotice>
          </div>
        )}

        <nav className="cl-public-tabs" aria-label="Public pages">
          <button className="cl-public-tab cl-public-tab--active" aria-current="page" onClick={() => go(`${base}/schedule`, 'schedule')}>
            Race schedule
          </button>
          <button className="cl-public-tab" onClick={() => go(`${base}/signup`, 'signup')}>
            Sign up
          </button>
        </nav>

        {err && (
          <ClNotice
            tone="error"
            title="Couldn’t load the race schedule"
            action={<ClButton variant="secondary" size="small" onClick={retry}>Try again</ClButton>}
          >
            {err}
          </ClNotice>
        )}
        {!err && !rows && <div className="cl-panel cl-panel__body"><ClSkeleton rows={3} /></div>}
        {!err && rows?.length === 0 && (
          <div className="cl-panel">
            <ClEmpty title="No upcoming races" hint="New races appear here once the team posts them." />
          </div>
        )}

        {!err && rows && rows.length > 0 && (
          <div className="cl-schedule-months">
            {groupByMonth(rows).map(([month, races]) => (
              <section className="cl-schedule-month" key={month} aria-label={month}>
                <h2>{month}</h2>
                <div className="cl-panel cl-schedule-panel">
                  {races.map(r => {
                    const time = fmtTime(r.start_time)
                    const location = r.location?.trim()
                    const hasSelectedCrew = r.selected_crew.length > 0
                    return (
                      <article key={r.race_id} className="cl-schedule-row">
                        <ScheduleDate iso={r.race_date} />
                        <div className="cl-schedule-race">
                          <h3>{r.race_name}</h3>
                          {(time || location) && (
                            <p className="cl-schedule-meta">
                              {time && <span className="cl-mono">{time}</span>}
                              {time && location && <span aria-hidden="true"> · </span>}
                              {location}
                            </p>
                          )}
                          {hasSelectedCrew ? (
                            <div className="cl-crew-list" aria-label={`Selected crew for ${r.race_name}`}>
                              {r.selected_crew.map(name => (
                                <span className="cl-crew-chip" key={name}><span aria-hidden="true" />{name}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="cl-schedule-pending">Crew not selected yet — sign up to be considered.</p>
                          )}
                        </div>
                        {!hasSelectedCrew && <ClStatus tone="neutral">Selection pending</ClStatus>}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
