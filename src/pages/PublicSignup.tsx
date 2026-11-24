import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  fetchDirectory, fetchSchedule, submitSignups, registerCrew, getTenant,
  fmtDate, fmtTime, groupByMonth, type DirectoryEntry, type ScheduleRow,
} from '@/lib/api'
import { ClButton, ClEmpty, ClInput, ClNotice, ClPageHeader, ClSkeleton, ClStatus, TeamBrand } from '@/components/CrewlistUI'
import { navigate } from '@/lib/hash'
import { currentTenantSlug, useTeamName } from '@/lib/tenant'

const previewDirectory: DirectoryEntry[] = [
  { tenant_slug: 'testing101', crew_id: 'preview-alex', name: 'Alex' },
  { tenant_slug: 'testing101', crew_id: 'preview-morgan', name: 'Morgan' },
  { tenant_slug: 'testing101', crew_id: 'preview-sam', name: 'Sam' },
  { tenant_slug: 'testing101', crew_id: 'preview-zoe', name: 'Zoë' },
]

const previewRaces: ScheduleRow[] = [
  {
    tenant_slug: 'testing101', race_id: 'preview-harbour-series', race_name: 'Harbour Series · Race 1',
    race_date: '2027-01-09', start_time: '09:05', location: 'Victoria Harbour', selected_crew: ['Alex', 'Morgan', 'Sam'],
  },
  {
    tenant_slug: 'testing101', race_id: 'preview-island-race', race_name: 'Island Race',
    race_date: '2027-01-23', start_time: '10:30', location: 'Royal Hong Kong Yacht Club', selected_crew: [],
  },
  {
    tenant_slug: 'testing101', race_id: 'preview-winter-regatta', race_name: 'Winter Regatta',
    race_date: '2027-02-06', start_time: '08:45', location: 'Middle Island', selected_crew: ['Alex', 'Morgan'],
  },
  {
    tenant_slug: 'testing101', race_id: 'preview-harbour-series-2', race_name: 'Harbour Series · Race 2',
    race_date: '2027-02-20', start_time: '09:05', location: 'Victoria Harbour', selected_crew: [], signup_closed: true,
  },
]

function SignupDate({ iso }: { iso: string }) {
  const { day, dow } = fmtDate(iso)
  return <time className="cl-schedule-date" dateTime={iso}><strong>{day}</strong><span>{dow}</span></time>
}

function RaceContent({ race }: { race: ScheduleRow }) {
  const time = fmtTime(race.start_time)
  const location = race.location?.trim()
  return (
    <div className="cl-signup-race__content">
      <span className="cl-signup-race__name">{race.race_name}</span>
      {(time || location) && (
        <p className="cl-schedule-meta">
          {time && <span className="cl-mono">{time}</span>}
          {time && location && <span aria-hidden="true"> · </span>}
          {location}
        </p>
      )}
    </div>
  )
}

function SignupActionBar({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="cl-signup-action">
      <div className="cl-container cl-signup-action__inner">{children}</div>
    </div>,
    document.body,
  )
}

export default function PublicSignup({
  preview = false,
  previewClosed = false,
}: {
  preview?: boolean
  previewClosed?: boolean
}) {
  const [dir, setDir] = useState<DirectoryEntry[] | null>(preview ? previewDirectory : null)
  const [races, setRaces] = useState<ScheduleRow[] | null>(preview ? previewRaces : null)
  const [err, setErr] = useState<string | null>(null)
  // undefined = still unknown (pre-settings-migration tenants report undefined too);
  // only an explicit false closes the form.
  const [signupOpen, setSignupOpen] = useState<boolean | undefined>(preview ? !previewClosed : undefined)

  const [crewId, setCrewId] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [newMode, setNewMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ name: string; count: number; pending: boolean } | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [previewAction, setPreviewAction] = useState(previewClosed
    ? 'Synthetic Testing101 data. Global sign-up closure is previewed without reading or changing tenant settings.'
    : 'Synthetic Testing101 data. Confirm and submit simulates the success state locally; no data is sent.')
  const liveTeamName = useTeamName()
  const teamName = preview ? 'Testing101' : liveTeamName
  const base = `/t/${currentTenantSlug()}`

  const load = useCallback(() => {
    if (preview) return
    Promise.all([fetchDirectory(), fetchSchedule(), getTenant()])
      .then(([d, s, t]) => { setDir(d); setRaces(s); setSignupOpen(t.signup_open ?? true) })
      .catch(e => setErr(e.message))
  }, [preview])
  useEffect(load, [load])

  function retry() {
    setErr(null)
    load()
  }

  function go(path: string, destination: 'schedule' | 'admin') {
    if (!preview) {
      navigate(path)
      return
    }
    setPreviewAction(destination === 'schedule'
      ? 'The public schedule is outside this signup outcome preview. No live page was opened.'
      : 'Admin is unchanged and will be restyled in a later phase.')
  }

  const filtered = useMemo(() => {
    if (!dir) return []
    const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = strip(query.trim())
    return q ? dir.filter(d => strip(d.name).includes(q)) : dir
  }, [dir, query])

  // Picked races in chronological order (fetchSchedule returns date-sorted rows)
  const pickedRaces = useMemo(
    () => (races ?? []).filter(r => picked.has(r.race_id)),
    [races, picked],
  )

  const toggle = (id: string) => {
    setPicked(p => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const selectedName = newMode
    ? newName.trim()
    : dir?.find(d => d.crew_id === crewId)?.name ?? ''

  function validate(): boolean {
    if (!newMode && !crewId) { setFormErr('Search and pick your name first.'); return false }
    if (newMode && newName.trim().length < 2) { setFormErr('Enter your full name.'); return false }
    if (picked.size === 0) { setFormErr('Tick at least one race.'); return false }
    return true
  }

  function beginReview() {
    setFormErr(null)
    if (!validate()) return
    setConfirming(true)
    window.scrollTo({ top: 0 })
  }

  async function submit() {
    setFormErr(null)
    if (preview) {
      setPreviewAction('Synthetic Testing101 data. This success screen was reached without registering crew or creating sign-ups.')
      setDone({ name: selectedName, count: picked.size, pending: newMode })
      window.scrollTo({ top: 0 })
      return
    }
    setBusy(true)
    try {
      let id = crewId
      let pending = false
      if (newMode) { id = await registerCrew(newName); pending = true }
      await submitSignups(id!, [...picked])
      setDone({ name: selectedName, count: picked.size, pending })
    } catch (e) {
      setFormErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function resetSignup() {
    setDone(null)
    setConfirming(false)
    setPicked(new Set())
    setCrewId(null)
    setNewMode(false)
    setNewName('')
    if (preview) {
      setPreviewAction('Synthetic Testing101 data. Confirm and submit simulates the success state locally; no data is sent.')
    }
    window.scrollTo({ top: 0 })
  }

  if (done) {
    return (
      <div className="cl-root cl-public-signup">
        <header className="cl-public-header">
          <div className="cl-container cl-public-header__inner">
            <button type="button" className="cl-public-brand" onClick={() => go(`${base}/schedule`, 'schedule')} aria-label={`${teamName} home`}><TeamBrand teamName={teamName} /></button>
            <ClButton variant="text" size="small" onClick={() => go(`${base}/admin`, 'admin')}>Admin</ClButton>
          </div>
        </header>
        <main className="cl-container cl-signup-outcome-main">
          {preview && <div className="cl-signup-preview-notice"><ClNotice tone="info" title="Step 2C preview">{previewAction}</ClNotice></div>}
          <section className="cl-panel cl-signup-outcome" aria-labelledby="signup-success-title">
            <span className="cl-signup-outcome__icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
            <p className="cl-eyebrow">SIGN-UP SUBMITTED</p>
            <h1 id="signup-success-title">You're on the list, {done.name}</h1>
            <p className="cl-signup-outcome__summary">{done.count} race{done.count > 1 ? 's' : ''} submitted.</p>
            <p className="cl-signup-outcome__copy">
              {done.pending
                ? 'As a new crew member, the team will review your details before you appear publicly.'
                : 'The team will confirm the selected crew closer to race day.'}
            </p>
            <p className="cl-signup-outcome__copy cl-signup-outcome__copy--muted">
              Need to withdraw? Message the team directly and they'll take you off the list.
            </p>
            <div className="cl-signup-outcome__actions">
              <ClButton onClick={resetSignup}>Sign up for more races</ClButton>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="cl-root cl-public-signup">
        <header className="cl-public-header">
          <div className="cl-container cl-public-header__inner">
            <button type="button" className="cl-public-brand" onClick={() => go(`${base}/schedule`, 'schedule')} aria-label={`${teamName} home`}><TeamBrand teamName={teamName} /></button>
            <ClButton variant="text" size="small" onClick={() => go(`${base}/admin`, 'admin')}>Admin</ClButton>
          </div>
        </header>
        <main className="cl-container cl-review-main">
          <ClPageHeader eyebrow="REVIEW SIGN-UP" title="Confirm your sign-up" description="Check the details below, then confirm." />
          {preview && <div className="cl-signup-preview-notice"><ClNotice tone="info" title="Step 2C preview">{previewAction}</ClNotice></div>}
          <div className="cl-review-grid">
            <section>
              <h2 className="cl-signup-section__heading">Your name</h2>
              <div className="cl-panel cl-panel__body">
                <p className="cl-review-name">{selectedName}</p>
                {newMode && <p className="cl-field__hint">New crew — the team will review your details before you appear publicly.</p>}
              </div>
            </section>
            <section>
              <h2 className="cl-signup-section__heading">Races · {pickedRaces.length}</h2>
              <div className="cl-panel cl-review-races">
                {pickedRaces.map(r => <div key={r.race_id} className="cl-review-race"><SignupDate iso={r.race_date} /><RaceContent race={r} /></div>)}
              </div>
            </section>
          </div>
        </main>
        <SignupActionBar>
          {formErr && <ClNotice tone="error" title="Couldn’t submit your sign-up">{formErr}</ClNotice>}
          <div className="cl-review-actions">
            <ClButton variant="secondary" disabled={busy} onClick={() => { setConfirming(false); setFormErr(null) }}>Back to edit</ClButton>
            <ClButton loading={busy} onClick={submit}>{busy ? 'Submitting…' : 'Confirm and submit'}</ClButton>
          </div>
        </SignupActionBar>
      </div>
    )
  }

  return (
    <div className="cl-root cl-public-signup">
      <header className="cl-public-header">
        <div className="cl-container cl-public-header__inner">
          <button type="button" className="cl-public-brand" onClick={() => go(`${base}/schedule`, 'schedule')} aria-label={`${teamName} home`}><TeamBrand teamName={teamName} /></button>
          <ClButton variant="text" size="small" onClick={() => go(`${base}/admin`, 'admin')}>Admin</ClButton>
        </div>
      </header>

      <main className="cl-container cl-signup-main">
        <ClPageHeader
          eyebrow="PUBLIC CREW SIGN-UP"
          title="Crew sign-up"
          description="Pick your name, tick the races you can do. The team confirms selection closer to the day."
        />
        {preview && <div className="cl-signup-preview-notice"><ClNotice tone="info" title="Step 2C preview">{previewAction}</ClNotice></div>}

        <nav className="cl-public-tabs" aria-label="Public pages">
          <button className="cl-public-tab" onClick={() => go(`${base}/schedule`, 'schedule')}>Race schedule</button>
          <button className="cl-public-tab cl-public-tab--active" aria-current="page" onClick={() => { if (!preview) navigate(`${base}/signup`) }}>Sign up</button>
        </nav>

        {err && <div className="cl-signup-state"><ClNotice tone="error" title="Couldn’t load crew sign-up" action={<ClButton variant="secondary" size="small" onClick={retry}>Try again</ClButton>}>{err}</ClNotice></div>}
        {!err && (!dir || !races || signupOpen === undefined) && <div className="cl-panel cl-panel__body cl-signup-state"><ClSkeleton rows={3} label="Loading crew sign-up" /></div>}

        {!err && signupOpen === false && dir && races && (
          <div className="cl-signup-state">
            <section className="cl-panel cl-signup-closed" aria-labelledby="signup-closed-title">
              <h2 id="signup-closed-title">Sign-ups are closed</h2>
              <p>
                The team isn't taking availability right now. Check the race
                schedule for confirmed crew lists, and check back here later.
              </p>
            </section>
          </div>
        )}

        {!err && signupOpen === true && dir && races && (
          <div className="cl-signup-form">
            <section className="cl-signup-section" aria-label="Your name">
              <div className="cl-panel cl-signup-name-panel">
                {!newMode ? (
                  <>
                    {crewId ? (
                      <div className="cl-selected-name">
                        <span className="cl-selected-name__check" aria-hidden="true">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        </span>
                        <strong>{selectedName}</strong>
                        <ClButton variant="text" size="small" onClick={() => { setCrewId(null); setQuery('') }} aria-label="Change name">Change</ClButton>
                      </div>
                    ) : (
                      <>
                        <ClInput id="crew-name-search" label="Search your name" placeholder="Search your name…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
                        {query.trim() !== '' && filtered.length > 0 && (
                          <div className="cl-directory" role="group" aria-label="Crew names">
                            {filtered.map(d => (
                              <button key={d.crew_id} type="button" onClick={() => { setCrewId(d.crew_id); setQuery('') }}>{d.name}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <ClButton variant="secondary" full onClick={() => { setNewMode(true); setCrewId(null) }}>I'm new to the team</ClButton>
                  </>
                ) : (
                  <div className="cl-new-crew">
                    <ClInput
                      id="new-crew-name"
                      label="Your full name"
                      placeholder="Your full name"
                      hint="New crew are reviewed by the team before appearing on the public list."
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      autoComplete="name"
                    />
                    <ClButton variant="secondary" full onClick={() => setNewMode(false)}>Back to the crew list</ClButton>
                  </div>
                )}
              </div>
            </section>

            <section className="cl-signup-section" aria-label="Races you can do">
              {races.length === 0 && <div className="cl-panel"><ClEmpty title="No upcoming races" hint="Check back soon." /></div>}
              <div className="cl-signup-months">
                {groupByMonth(races).map(([month, rs]) => (
                  <section key={month} className="cl-signup-month" aria-label={month}>
                    <h3>{month}</h3>
                    <div className="cl-panel cl-signup-races">
                      {rs.map(r => r.signup_closed ? (
                        <div key={r.race_id} className="cl-signup-race cl-signup-race--closed">
                          <SignupDate iso={r.race_date} />
                          <div className="cl-signup-race__details">
                            <RaceContent race={r} />
                            <ClStatus tone="neutral" label="Sign-ups closed for this race">Closed</ClStatus>
                          </div>
                        </div>
                      ) : (
                        <label key={r.race_id} className={`cl-signup-race cl-signup-race--open${picked.has(r.race_id) ? ' cl-signup-race--picked' : ''}`}>
                          <input type="checkbox" checked={picked.has(r.race_id)} onChange={() => toggle(r.race_id)} />
                          <SignupDate iso={r.race_date} />
                          <RaceContent race={r} />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {!err && signupOpen === true && dir && races && (
        <SignupActionBar>
          {formErr && <ClNotice tone="error" title="Check your sign-up">{formErr}</ClNotice>}
          <div className="cl-signup-review-action">
            <ClButton onClick={beginReview}>{picked.size > 0 ? `Review ${picked.size} race${picked.size > 1 ? 's' : ''}` : 'Review sign-up'}</ClButton>
          </div>
        </SignupActionBar>
      )}
    </div>
  )
}
