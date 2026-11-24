import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ClButton,
  ClEmpty,
  ClInput,
  ClNotice,
  ClSkeleton,
  ClStatus,
  ClTabs,
  CrewlistBrand,
  TeamBrand,
} from '@/components/CrewlistUI'

type Race = {
  id: string
  day: string
  month: string
  title: string
  location: string
  time: string
  status: string
  tone: 'open' | 'selected' | 'neutral'
}

type ListState = 'ready' | 'loading' | 'empty' | 'error'
type RaceTab = 'upcoming' | 'selected' | 'closed'

const initialRaces: Race[] = [
  {
    id: 'harbour',
    day: '14',
    month: 'NOV',
    title: 'Harbour Sprint',
    location: 'Victoria Harbour',
    time: '09:05',
    status: 'Open',
    tone: 'open',
  },
  {
    id: 'island',
    day: '22',
    month: 'NOV',
    title: 'Island Race',
    location: 'Royal Hong Kong Yacht Club',
    time: '10:30',
    status: '12 signed up',
    tone: 'selected',
  },
  {
    id: 'autumn',
    day: '08',
    month: 'NOV',
    title: 'Autumn Regatta',
    location: 'Middle Island',
    time: '08:45',
    status: 'Closed',
    tone: 'neutral',
  },
]

const initialForm = {
  name: initialRaces[0].title,
  location: initialRaces[0].location,
  time: initialRaces[0].time,
}

const raceTabs: Array<{ id: RaceTab; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'selected', label: 'My races' },
  { id: 'closed', label: 'Closed' },
]

function FoundationSection({
  label,
  title,
  intro,
  children,
}: {
  label: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <section className="cl-foundation-section" aria-label={title}>
      <p className="cl-foundation-section__label">{label}</p>
      <div>
        <h2 className="cl-foundation-section__heading">{title}</h2>
        <p className="cl-foundation-section__intro">{intro}</p>
        {children}
      </div>
    </section>
  )
}

function normaliseTime(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed)
  if (!match || Number(match[1]) > 23) return null
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export default function DesignFoundation() {
  const [races, setRaces] = useState<Race[]>(initialRaces)
  const [form, setForm] = useState(initialForm)
  const [formErrors, setFormErrors] = useState<{ name?: string; time?: string }>({})
  const [saved, setSaved] = useState(false)
  const [editorDeleted, setEditorDeleted] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [listState, setListState] = useState<ListState>('ready')
  const [activeTab, setActiveTab] = useState<RaceTab>('upcoming')
  const [buttonFeedback, setButtonFeedback] = useState('')

  const visibleRaces = races.filter(race => {
    if (activeTab === 'selected') return race.tone === 'selected'
    if (activeTab === 'closed') return race.tone === 'neutral'
    return race.tone !== 'neutral'
  })

  function scrollToEditor(focusName = false) {
    document.getElementById('race-editor')?.scrollIntoView({ block: 'center' })
    if (focusName) document.getElementById('foundation-race-name')?.focus()
  }

  function resetDemo() {
    setRaces(initialRaces)
    setForm(initialForm)
    setFormErrors({})
    setSaved(false)
    setEditorDeleted(false)
    setDeleteConfirm(false)
    setListState('ready')
    setActiveTab('upcoming')
    setButtonFeedback('')
  }

  function saveRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalisedTime = normaliseTime(form.time)
    const errors: { name?: string; time?: string } = {}
    if (!form.name.trim()) errors.name = 'Enter a race name.'
    if (normalisedTime === null) errors.time = 'Use 24-hour HH:MM, for example 09:05.'
    setFormErrors(errors)
    setSaved(false)
    if (Object.keys(errors).length > 0 || normalisedTime === null) return

    const nextForm = { ...form, name: form.name.trim(), location: form.location.trim(), time: normalisedTime }
    setForm(nextForm)
    setRaces(current => current.map(race => race.id === 'harbour' ? {
      ...race,
      title: nextForm.name,
      location: nextForm.location || 'Location to be confirmed',
      time: nextForm.time || 'Time to be confirmed',
    } : race))
    setDeleteConfirm(false)
    setSaved(true)
  }

  function confirmDelete() {
    setRaces(current => current.filter(race => race.id !== 'harbour'))
    setEditorDeleted(true)
    setDeleteConfirm(false)
    setSaved(false)
  }

  function requestDelete() {
    if (editorDeleted) resetDemo()
    setDeleteConfirm(true)
    setSaved(false)
    window.setTimeout(() => scrollToEditor(), 0)
  }

  return (
    <div className="cl-root cl-foundation">
      <header className="cl-foundation-header">
        <div className="cl-container cl-foundation-header__inner">
          <CrewlistBrand />
          <div className="cl-foundation-header__meta">
            <span>FOUNDATION / DESIGN PREVIEW</span>
          </div>
        </div>
      </header>

      <main className="cl-container">
        <section className="cl-foundation-hero" aria-labelledby="foundation-title">
          <div className="cl-foundation-hero__copy">
            <p className="cl-eyebrow">Crewlist interface system · Step 1</p>
            <h1 id="foundation-title">One visual language. Every crew interaction.</h1>
            <p>A working foundation for public schedules, sailor signup, team administration and console screens. It extends the approved modern software direction without changing the live product.</p>
          </div>
          <aside className="cl-foundation-hero__scope" aria-label="Preview scope">
            <dl>
              <div><dt>Phase</dt><dd>Shared foundation</dd></div>
              <div><dt>Data</dt><dd>Synthetic, browser-local</dd></div>
              <div><dt>Production</dt><dd>Unchanged, not deployed</dd></div>
            </dl>
          </aside>
        </section>

        <FoundationSection
          label="COLOUR"
          title="Bright blue does the work."
          intro="White surfaces, dark readable text and cool hairlines carry the interface. Blue is reserved for actions, focus and selected states; semantic colours communicate status only."
        >
          <div className="cl-swatches">
            {[
              ['Action', '#0064e6', 'var(--cl-accent)'],
              ['Ink', '#101828', 'var(--cl-ink)'],
              ['Slate', '#475467', 'var(--cl-slate)'],
              ['Line', '#d7e4f5', 'var(--cl-line)'],
              ['Page', '#f7faff', 'var(--cl-page)'],
            ].map(([name, hex, colour]) => (
              <div className="cl-swatch" key={name}>
                <div className="cl-swatch__colour" style={{ background: colour }} />
                <strong>{name}</strong>
                <span>{hex}</span>
              </div>
            ))}
          </div>
        </FoundationSection>

        <FoundationSection
          label="TYPOGRAPHY"
          title="Human copy. Precise race data."
          intro="Inter handles reading and actions. IBM Plex Mono distinguishes times, dates, compact labels and numbers without making the whole product feel technical."
        >
          <div className="cl-type-specimen">
            <div>
              <h3 className="cl-type-specimen__display">Racing starts with a clear plan.</h3>
              <p className="cl-type-specimen__body">Crew can see the next race, check the meeting point and sign up without creating an account. Admins get the same calm hierarchy for the operational work behind it.</p>
            </div>
            <div className="cl-type-specimen__data">
              <span>START / HKT</span>
              <strong>09:05</strong>
              <p>24-hour times and tabular numerals stay aligned across schedule, signup and admin views.</p>
            </div>
          </div>
        </FoundationSection>

        <FoundationSection
          label="CONTROLS"
          title="One hierarchy, every state."
          intro="Primary actions are blue. Secondary actions retain a surface. Destructive actions stay red and separate. Disabled and loading controls remain legible rather than disappearing."
        >
          <div className="cl-component-row">
            <p className="cl-component-label">BUTTONS</p>
            <ClButton onClick={() => setButtonFeedback('Sample changes saved locally.')}>Save changes</ClButton>
            <ClButton variant="secondary" onClick={() => scrollToEditor(true)}>Add race</ClButton>
            <ClButton variant="ghost" onClick={() => { setListState('ready'); document.getElementById('state-lab')?.scrollIntoView({ block: 'center' }) }}>Preview races</ClButton>
            <ClButton variant="danger" onClick={requestDelete}>Delete</ClButton>
            <ClButton variant="text" onClick={resetDemo}>Reset preview</ClButton>
          </div>
          <div className="cl-component-row">
            <p className="cl-component-label">UNAVAILABLE AND IN PROGRESS</p>
            <ClButton disabled>Unavailable</ClButton>
            <ClButton variant="secondary" loading>Saving changes</ClButton>
            <ClStatus tone="open">Open</ClStatus>
            <ClStatus tone="selected">12 signed up</ClStatus>
            <ClStatus tone="warning">Closing soon</ClStatus>
            <ClStatus tone="danger">Cancelled</ClStatus>
            <ClStatus>Closed</ClStatus>
          </div>
          {buttonFeedback && (
            <div className="cl-demo-notice">
              <ClNotice tone="success" title="Local interaction complete">{buttonFeedback} No database request was made.</ClNotice>
            </div>
          )}
        </FoundationSection>

        <FoundationSection
          label="FORMS"
          title="Validation belongs beside the field."
          intro="Labels remain visible, optional fields are explicit and errors explain the correction. Try an invalid time such as 25:00, or save 9:05 to see normalisation."
        >
          <div className="cl-demo-grid">
            <div className="cl-panel" id="race-editor">
              <div className="cl-panel__header">
                <TeamBrand teamName="Scallywag" />
                <ClStatus tone={editorDeleted ? 'danger' : 'selected'}>{editorDeleted ? 'Deleted locally' : 'Editing sample'}</ClStatus>
              </div>
              {editorDeleted ? (
                <ClEmpty
                  title="Sample race deleted"
                  hint="Only the synthetic race in this preview was removed. Restore it to continue testing the editor."
                  action={<ClButton variant="secondary" onClick={resetDemo}>Restore sample race</ClButton>}
                />
              ) : (
                <>
                  <div className="cl-panel__body">
                    <form className="cl-demo-form" id="foundation-race-form" onSubmit={saveRace} noValidate>
                      <ClInput
                        id="foundation-race-name"
                        label="Race name"
                        value={form.name}
                        error={formErrors.name}
                        onChange={event => { setForm({ ...form, name: event.target.value }); setSaved(false) }}
                        required
                      />
                      <ClInput
                        id="foundation-race-location"
                        label="Location"
                        value={form.location}
                        hint="Shown to sailors on the schedule and signup page."
                        optional
                        onChange={event => { setForm({ ...form, location: event.target.value }); setSaved(false) }}
                      />
                      <ClInput
                        id="foundation-race-time"
                        label="Start time"
                        value={form.time}
                        hint="24-hour time. Leave empty if the start time is not confirmed."
                        error={formErrors.time}
                        optional
                        inputMode="numeric"
                        placeholder="HH:MM"
                        onChange={event => { setForm({ ...form, time: event.target.value }); setSaved(false) }}
                      />
                    </form>
                    {saved && (
                      <div className="cl-demo-notice">
                        <ClNotice tone="success" title="Saved to this preview">The sample schedule now reflects these details. No server request was made.</ClNotice>
                      </div>
                    )}
                    {deleteConfirm && (
                      <div className="cl-delete-confirm" role="alert">
                        <p>Delete Harbour Sprint on 14 November and its 12 sample sign-ups? This cannot be undone.</p>
                        <div>
                          <ClButton variant="secondary" size="small" onClick={() => setDeleteConfirm(false)}>Cancel</ClButton>
                          <ClButton variant="danger" size="small" onClick={confirmDelete}>Delete race</ClButton>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="cl-action-dock">
                    <div className="cl-action-dock__inner">
                      <ClButton type="submit" form="foundation-race-form">Save changes</ClButton>
                      <ClButton variant="secondary" onClick={resetDemo}>Reset</ClButton>
                      <ClButton variant="danger" onClick={() => { setDeleteConfirm(true); setSaved(false) }}>Delete race</ClButton>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="cl-state-stack">
              <ClNotice tone="info" title="Sailors never need accounts">A name and email are enough to sign up. Account creation stays with team administrators.</ClNotice>
              <ClNotice tone="warning" title="Signup closes at 18:00">Changes after the cutoff require an admin, so the warning stays visible without blocking the rest of the page.</ClNotice>
              <div className="cl-panel cl-panel--raised">
                <div className="cl-panel__body">
                  <p className="cl-eyebrow">MOBILE ACTION DOCK</p>
                  <p className="cl-muted">On narrow screens, these actions stack full-width in task order.</p>
                </div>
                <div className="cl-action-dock">
                  <div className="cl-action-dock__inner">
                    <ClButton onClick={() => setButtonFeedback('Sample crew signup saved locally.')}>Confirm signup</ClButton>
                    <ClButton variant="secondary" onClick={() => setButtonFeedback('Sample signup cleared locally.')}>Clear</ClButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FoundationSection>

        <div id="state-lab">
          <FoundationSection
            label="APPLICATION STATES"
            title="The schedule beyond the happy path."
            intro="Switch between ready, loading, empty and error states. Tabs support Left/Right arrows plus Home/End; every example below uses the same race data model."
          >
            <div className="cl-state-controls" aria-label="Schedule preview state">
              {(['ready', 'loading', 'empty', 'error'] as ListState[]).map(state => (
                <ClButton
                  key={state}
                  variant="secondary"
                  size="small"
                  aria-pressed={listState === state}
                  onClick={() => setListState(state)}
                >
                  {state[0].toUpperCase() + state.slice(1)}
                </ClButton>
              ))}
            </div>

            {listState === 'ready' && (
              <>
                <ClTabs
                  idPrefix="foundation-races"
                  items={raceTabs}
                  active={activeTab}
                  onChange={id => setActiveTab(id as RaceTab)}
                  label="Race schedule views"
                />
                <div
                  className="cl-panel cl-race-panel"
                  id="foundation-races-panel"
                  role="tabpanel"
                  aria-labelledby={`foundation-races-${activeTab}`}
                >
                  <div className="cl-race-list">
                    {visibleRaces.map(race => (
                      <article className="cl-race-row" key={race.id}>
                        <div className="cl-race-date"><strong>{race.day}</strong><span>{race.month}</span></div>
                        <div>
                          <h3>{race.title}</h3>
                          <p><span className="cl-mono">{race.time}</span> · {race.location}</p>
                        </div>
                        <ClStatus tone={race.tone}>{race.status}</ClStatus>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
            {listState === 'loading' && <div className="cl-panel cl-panel__body"><ClSkeleton rows={3} /></div>}
            {listState === 'empty' && (
              <div className="cl-panel">
                <ClEmpty
                  title="No races published yet"
                  hint="When the team publishes its next race, sailors will see it here with the meeting details and signup action."
                  action={<ClButton variant="secondary" onClick={() => setListState('ready')}>Show sample races</ClButton>}
                />
              </div>
            )}
            {listState === 'error' && (
              <ClNotice
                tone="error"
                title="Couldn’t load the race schedule"
                action={<ClButton variant="secondary" size="small" onClick={() => setListState('ready')}>Try again</ClButton>}
              >
                The connection failed before any sample data changed. Retry to restore the local schedule.
              </ClNotice>
            )}
          </FoundationSection>
        </div>

        <footer className="cl-foundation-footer">
          <span>Step 1 is an isolated implementation preview. Existing public, signup, authentication, admin and console screens remain on their current styles.</span>
          <ClButton variant="text" size="small" onClick={resetDemo}>Reset all sample data</ClButton>
        </footer>
      </main>
    </div>
  )
}
