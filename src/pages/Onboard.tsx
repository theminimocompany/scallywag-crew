import { useEffect, useRef, useState } from 'react'
import { navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClInput, ClNotice, ClStatus } from '@/components/CrewlistUI'
import {
  getTenant, updateTeamName, fetchRaces, parseRhkycCsv,
  addRacesBulk, addCrewBulk, type Tenant, type CsvRace,
} from '@/lib/api'

const SAMPLE_CSV = 'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private\n' +
  'Frostbite 2 & 3 (Harbour),14/11/2026,10:30,14/11/2026,16:00,False,,Harbour,False\n' +
  'Waglan Series (Middle Island),22/11/2026,10:00,22/11/2026,17:00,False,,Middle Island,False\n' +
  'Rogue 2 (Harbour Start),06/12/2026,10:30,06/12/2026,16:00,False,,Harbour,False\n'

export type OnboardPreview =
  | 'loading'
  | 'error'
  | 'team'
  | 'team-loading'
  | 'team-error'
  | 'calendar'
  | 'calendar-preview'
  | 'calendar-empty'
  | 'calendar-loading'
  | 'calendar-error'
  | 'crew'
  | 'crew-ready'
  | 'crew-loading'
  | 'crew-error'
  | 'live'
  | 'live-imported'

const PREVIEW_TENANT: Tenant = { id: 'synthetic-team', name: 'Sea Wolf', slug: 'sea-wolf', status: 'active' }
const PREVIEW_RACES: CsvRace[] = [
  { name: 'Frostbite 2 & 3 (Harbour)', date: '2026-11-14', startTime: '10:30', location: 'Harbour', duplicate: false, include: true },
  { name: 'Waglan Series (Middle Island)', date: '2026-11-22', startTime: '10:00', location: 'Middle Island', duplicate: false, include: true },
  { name: 'Rogue 2 (Harbour Start)', date: '2026-12-06', startTime: '10:30', location: 'Harbour', duplicate: true, include: false },
]
const PREVIEW_CREW = 'Marco Bellini\nSophie Delacroix\nTommy Ashford'

function previewStep(preview?: OnboardPreview) {
  if (preview?.startsWith('calendar')) return 2
  if (preview?.startsWith('crew')) return 3
  if (preview?.startsWith('live')) return 4
  return 1
}

function previewError(preview?: OnboardPreview) {
  if (preview === 'error') return 'We couldn’t load this team. Check your access and try again.'
  if (preview?.endsWith('-error')) return 'The import couldn’t be completed. Nothing was added; try again.'
  return null
}

export default function Onboard({ email, preview }: { email: string; preview?: OnboardPreview }) {
  const [step, setStep] = useState(() => previewStep(preview))
  const [tenant, setTenant] = useState<Tenant | null>(() => preview && preview !== 'loading' && preview !== 'error' ? PREVIEW_TENANT : null)
  const [name, setName] = useState(preview && preview !== 'loading' && preview !== 'error' ? PREVIEW_TENANT.name : '')
  const [busy, setBusy] = useState(!!preview?.endsWith('-loading'))
  const [err, setErr] = useState<string | null>(() => previewError(preview))
  const hasCsvPreview = preview === 'calendar-preview' || preview === 'calendar-loading' || preview === 'calendar-error'
  const [csvRaces, setCsvRaces] = useState<CsvRace[] | null>(() => hasCsvPreview ? PREVIEW_RACES : preview === 'calendar-empty' ? [] : null)
  const [fileName, setFileName] = useState(hasCsvPreview || preview === 'calendar-empty' ? 'rhkyc-calendar.csv' : '')
  const [crewText, setCrewText] = useState(preview === 'crew-ready' || preview === 'crew-loading' || preview === 'crew-error' ? PREVIEW_CREW : '')
  const [imported, setImported] = useState(preview === 'live-imported' ? { races: 2, crew: 3 } : { races: 0, crew: 0 })
  const [copied, setCopied] = useState(false)
  const [previewNotice, setPreviewNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadTenant() {
    setErr(null)
    if (preview) {
      setTenant(PREVIEW_TENANT)
      setName(PREVIEW_TENANT.name)
      return
    }
    try {
      const t = await getTenant()
      setTenant(t)
      setName(t.name)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (preview) return
    getTenant().then(t => { setTenant(t); setName(t.name) }).catch(e => setErr(e?.message ?? String(e)))
  }, [preview])

  const crewNames = [...new Set(crewText.split('\n').map(s => s.trim()).filter(Boolean))]
  const racesToImport = (csvRaces ?? []).filter(r => r.include)
  const publicLink = tenant ? `${window.location.origin}${window.location.pathname}#/t/${tenant.slug}/schedule` : ''

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'crewlist-sample-races.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onFile(f: File) {
    setErr(null); setFileName(f.name)
    try {
      const text = await f.text()
      const existing = preview ? [] : await fetchRaces()
      setCsvRaces(parseRhkycCsv(text, existing))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function run(fn: () => Promise<void>, next: number) {
    setBusy(true); setErr(null); setPreviewNotice(null)
    try {
      await fn()
      setStep(next)
      if (preview) setPreviewNotice('The step change was simulated locally. No team data was written.')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function copyPublicLink() {
    if (preview) {
      setCopied(true)
      setPreviewNotice('Copy link was simulated locally. Your clipboard is unchanged.')
      return
    }
    try { await navigator.clipboard.writeText(publicLink); setCopied(true) }
    catch { window.prompt('Copy your team link:', publicLink) }
  }

  const stepMeta = ['Team', 'Race calendar', 'Your crew', 'Live'][step - 1]

  return (
    <ClAuthShell
      wide
      preview={preview ? `Synthetic ${preview.replaceAll('-', ' ')} state. No tenant lookup, import, or clipboard write will occur.` : undefined}
      previewTitle="Step 3B preview"
      action={(
        <span className="cl-onboard-identity">
          <strong>{tenant?.name ?? 'Crewlist team'}</strong>
          <span>{email}</span>
        </span>
      )}
    >
      <div className="cl-onboard-progress" role="progressbar" aria-label="Team onboarding" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-valuetext={`Step ${step} of 4: ${stepMeta}`}>
        {[1, 2, 3, 4].map(i => <span key={i} className={i <= step ? 'cl-onboard-progress__done' : ''} />)}
      </div>
      <p className="cl-eyebrow cl-onboard-step">STEP {step} OF 4 · {stepMeta}</p>

      {previewNotice && (
        <div className="cl-onboard-preview-result">
          <ClNotice tone="success" title="Preview only">{previewNotice}</ClNotice>
        </div>
      )}

      {!tenant && !err && (
        <div className="cl-auth-loading">
          <span className="cl-auth-spinner" aria-hidden="true" />
          <h1>Loading your team…</h1>
          <p>Getting the new workspace ready.</p>
        </div>
      )}
      {err && (
        <div className="cl-onboard-error">
          <ClNotice
            tone="error"
            title={tenant ? 'Something went wrong' : 'Team unavailable'}
            action={!tenant ? <ClButton variant="secondary" size="small" onClick={() => void loadTenant()}>Try again</ClButton> : undefined}
          >
            {err}
          </ClNotice>
        </div>
      )}

      {tenant && step === 1 && (
        <section>
          <div className="cl-onboard-heading">
            <h1>Name your team</h1>
            <p>This name sits at the top of every page your crew sees.</p>
          </div>
          <form className="cl-auth-form" onSubmit={e => {
            e.preventDefault()
            void run(async () => { if (!preview && name.trim() !== tenant.name) await updateTeamName(name) }, 2)
          }}>
            <ClInput id="team-name" label="Team name" value={name} maxLength={60} required onChange={e => setName(e.target.value)} />
            <div className="cl-team-link">
              <p className="cl-label">Your team link</p>
              <p className="cl-team-link__address">{publicLink}</p>
            </div>
            <ClButton full type="submit" loading={busy} disabled={busy || !name.trim()}>Save & continue →</ClButton>
          </form>
        </section>
      )}

      {tenant && step === 2 && (
        <section>
          <div className="cl-onboard-heading">
            <h1>Import your races</h1>
            <p>Upload your club’s CSV, such as the RHKYC export, or skip and add races one by one later.</p>
          </div>
          <div className="cl-auth-form">
            <button type="button" className="cl-sample-link" onClick={downloadSample}>Download a sample CSV <span aria-hidden="true">↓</span></button>
            <button type="button" className="cl-file-drop" onClick={() => fileRef.current?.click()}>
              <span className="cl-file-drop__icon" aria-hidden="true">↑</span>
              <strong>{fileName ? 'Choose a different CSV' : 'Choose your CSV'}</strong>
              <span>{fileName ? `${fileName} · ${csvRaces?.length ?? 0} races found` : 'RHKYC Google Calendar export works out of the box'}</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="cl-sr-only" aria-label="Race calendar CSV" onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />

            {csvRaces && csvRaces.length > 0 && (
              <>
                <div className="cl-import-summary">
                  <p className="cl-eyebrow">PREVIEW · FIRST {Math.min(3, csvRaces.length)} OF {csvRaces.length} RACES</p>
                  <ClStatus tone="selected">{racesToImport.length} to import</ClStatus>
                </div>
                <div className="cl-panel cl-import-races">
                  {csvRaces.slice(0, 3).map(r => (
                    <div key={r.name + r.date} className="cl-import-race">
                      <span className="cl-mono cl-import-race__date">{r.date}</span>
                      <div>
                        <strong>{r.name}</strong>
                        {(r.startTime || r.location) && <p>{[r.startTime, r.location].filter(Boolean).join(' · ')}</p>}
                      </div>
                      {r.duplicate && <ClStatus>Already added</ClStatus>}
                    </div>
                  ))}
                </div>
                <ClButton full loading={busy} disabled={busy || racesToImport.length === 0} onClick={() => void run(async () => {
                  if (!preview) {
                    await addRacesBulk(racesToImport.map(r => ({
                      name: r.name,
                      race_date: r.date,
                      start_time: r.startTime || null,
                      location: r.location.trim() || null,
                    })))
                  }
                  setImported(v => ({ ...v, races: racesToImport.length }))
                }, 3)}>
                  Import {racesToImport.length} races →
                </ClButton>
              </>
            )}
            {csvRaces && csvRaces.length === 0 && (
              <ClNotice tone="warning" title="No races found">Check the file format against the sample, or skip this step and add races later.</ClNotice>
            )}
            <ClButton variant="text" full onClick={() => setStep(3)}>No CSV? Add races one by one later, or skip</ClButton>
          </div>
        </section>
      )}

      {tenant && step === 3 && (
        <section>
          <div className="cl-onboard-heading">
            <h1>Add your crew names</h1>
            <p>Paste your roster, one name per line — straight from your WhatsApp group works fine.</p>
          </div>
          <div className="cl-auth-form">
            <div className="cl-field">
              <label className="cl-label" htmlFor="crew-names">Crew roster</label>
              <textarea id="crew-names" className="cl-input cl-crew-textarea" value={crewText}
                placeholder={'Marco Bellini\nSophie Delacroix\nTommy Ashford'} onChange={e => setCrewText(e.target.value)} />
            </div>
            <div className="cl-crew-summary">
              <ClStatus tone="selected">{crewNames.length} names recognised</ClStatus>
              <span>Approved automatically as your founding roster</span>
            </div>
            <p className="cl-onboard-note">Phones and emergency contacts are optional — add them later in Crew settings.</p>
            <ClButton full loading={busy} disabled={busy || crewNames.length === 0} onClick={() => void run(async () => {
              if (!preview) await addCrewBulk(crewNames)
              setImported(v => ({ ...v, crew: crewNames.length }))
            }, 4)}>
              Add {crewNames.length} crew →
            </ClButton>
            <ClButton variant="text" full onClick={() => setStep(4)}>Skip — I’ll add crew later</ClButton>
          </div>
        </section>
      )}

      {tenant && step === 4 && (
        <section>
          <div className="cl-onboard-success-mark" aria-hidden="true">✓</div>
          <div className="cl-onboard-heading">
            <h1>You’re live</h1>
            <p>
              {tenant.name} is on Crewlist{imported.races ? ` · ${imported.races} races` : ''}{imported.crew ? ` · ${imported.crew} crew` : ''}.
              Share this link with your crew — they never need an account.
            </p>
          </div>
          <div className="cl-auth-form">
            <div className="cl-team-link">
              <p className="cl-label">Your public signup page</p>
              <p className="cl-team-link__address">{publicLink}</p>
              <ClButton variant="secondary" full onClick={() => void copyPublicLink()}>{copied ? 'Copied ✓' : 'Copy link'}</ClButton>
            </div>
            <ClButton full onClick={() => {
              if (preview) setPreviewNotice('Open team admin was simulated locally.')
              else navigate(`/t/${tenant.slug}/admin`)
            }}>Open team admin →</ClButton>
            <ClButton variant="secondary" full onClick={() => {
              if (preview) setPreviewNotice('View public page was simulated locally.')
              else navigate(`/t/${tenant.slug}/schedule`)
            }}>View public page</ClButton>
          </div>
        </section>
      )}
    </ClAuthShell>
  )
}
