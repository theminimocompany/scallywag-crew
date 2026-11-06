import { useEffect, useRef, useState } from 'react'
import { navigate } from '@/lib/hash'
import { ErrText, Spinner } from '@/components/bits'
import {
  getTenant, updateTeamName, fetchRaces, parseRhkycCsv,
  addRacesBulk, addCrewBulk, type Tenant, type CsvRace,
} from '@/lib/api'

const SAMPLE_CSV = 'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private\n' +
  'Frostbite 2 & 3 (Harbour),14/11/2026,10:30,14/11/2026,16:00,False,,Harbour,False\n' +
  'Waglan Series (Middle Island),22/11/2026,10:00,22/11/2026,17:00,False,,Middle Island,False\n' +
  'Rogue 2 (Harbour Start),06/12/2026,10:30,06/12/2026,16:00,False,,Harbour,False\n'

export default function Onboard({ email }: { email: string }) {
  const [step, setStep] = useState(1)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [csvRaces, setCsvRaces] = useState<CsvRace[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [crewText, setCrewText] = useState('')
  const [imported, setImported] = useState({ races: 0, crew: 0 })
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getTenant().then(t => { setTenant(t); setName(t.name) }).catch(e => setErr(e?.message ?? String(e)))
  }, [])

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
      const existing = await fetchRaces()
      setCsvRaces(parseRhkycCsv(text, existing))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function run(fn: () => Promise<void>, next: number) {
    setBusy(true); setErr(null)
    try { await fn(); setStep(next) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const stepMeta = ['Team', 'Race calendar', 'Your crew', 'Live'][step - 1]

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <span className="wordmark" style={{ textTransform: 'none' }}>Crewlist.</span>
          <span className="text-xs" style={{ color: 'hsl(var(--slate))' }}>{tenant?.name ?? '…'} · {email}</span>
        </div>
      </header>

      <main className="page flex-1 py-8 fade-in">
        <div className="flex gap-2 mb-5" aria-hidden>
          {[1, 2, 3, 4].map(i => (
            <span key={i} style={{ height: 4, flex: 1, borderRadius: 999, background: i <= step ? 'hsl(var(--royal))' : 'hsl(var(--frost))' }} />
          ))}
        </div>
        <p className="text-xs mb-1" style={{ color: 'hsl(var(--slate))' }}>Step {step} of 4 · {stepMeta}</p>

        {!tenant && !err && <Spinner />}
        {err && <div className="mb-4"><ErrText>{err}</ErrText></div>}

        {tenant && step === 1 && (
          <section className="space-y-4">
            <h1 className="font-semibold" style={{ fontSize: 24 }}>Name your team</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              This name sits at the top of every page your crew sees.
            </p>
            <div>
              <label htmlFor="team-name" className="text-xs uppercase font-medium block mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Team name</label>
              <input id="team-name" className="input" value={name} maxLength={60} onChange={e => setName(e.target.value)} />
            </div>
            <div className="panel p-3">
              <p className="text-xs uppercase font-medium mb-1" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>Your team link</p>
              <p className="text-sm break-all font-medium">{publicLink}</p>
            </div>
            <button className="btn-primary w-full" disabled={busy || !name.trim()}
              onClick={() => run(async () => { if (name.trim() !== tenant.name) await updateTeamName(name) }, 2)}>
              Save & continue →
            </button>
          </section>
        )}

        {tenant && step === 2 && (
          <section className="space-y-4">
            <h1 className="font-semibold" style={{ fontSize: 24 }}>Import your races</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              Upload your club's CSV (e.g. the RHKYC export).{' '}
              <button className="font-medium cursor-pointer" style={{ color: 'hsl(var(--royal))' }} onClick={downloadSample}>Download a sample CSV</button>{' '}
              to see the format.
            </p>
            <button className="panel w-full p-8 text-center cursor-pointer" style={{ borderStyle: 'dashed' }} onClick={() => fileRef.current?.click()}>
              <span className="text-sm font-medium">Tap to choose your CSV</span>
              <span className="block text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                {fileName ? `${fileName} · ${csvRaces?.length ?? 0} races found` : 'RHKYC Google Calendar export works out of the box'}
              </span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

            {csvRaces && csvRaces.length > 0 && (
              <>
                <p className="text-xs uppercase font-medium" style={{ letterSpacing: '0.08em', color: 'hsl(var(--slate))' }}>
                  Preview · first {Math.min(3, csvRaces.length)} of {csvRaces.length} races
                </p>
                <div className="panel divide-y divide-[hsl(var(--frost))]">
                  {csvRaces.slice(0, 3).map(r => (
                    <div key={r.name + r.date} className="flex gap-4 p-3 text-sm">
                      <span className="mono flex-none">{r.date}</span>
                      <span>{r.name}{r.duplicate ? ' · already added' : ''}</span>
                    </div>
                  ))}
                </div>
                <button className="btn-primary w-full" disabled={busy || racesToImport.length === 0}
                  onClick={() => run(async () => {
                    await addRacesBulk(racesToImport.map(r => ({ name: r.name, race_date: r.date })))
                    setImported(v => ({ ...v, races: racesToImport.length }))
                  }, 3)}>
                  Import {racesToImport.length} races →
                </button>
              </>
            )}
            {csvRaces && csvRaces.length === 0 && (
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>No races found in that file — check the format against the sample.</p>
            )}
            <button className="w-full text-center text-sm font-medium cursor-pointer" style={{ minHeight: 44 }} onClick={() => setStep(3)}>
              No CSV? Add races one by one later, or skip
            </button>
          </section>
        )}

        {tenant && step === 3 && (
          <section className="space-y-4">
            <h1 className="font-semibold" style={{ fontSize: 24 }}>Add your crew names</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              Paste your roster, one name per line — straight from your WhatsApp group works fine.
            </p>
            <textarea className="input" style={{ minHeight: 220, resize: 'vertical' }} value={crewText}
              placeholder={'Chan Tai Man\nBianca Fong\nChris Collins'} onChange={e => setCrewText(e.target.value)} />
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--royal))', border: '1px solid hsl(var(--royal))', borderRadius: 999, padding: '3px 10px' }}>
                {crewNames.length} names recognised
              </span>
              <span className="text-xs" style={{ color: 'hsl(var(--slate))' }}>All approved automatically as your founding roster</span>
            </div>
            <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
              Phones & emergency contacts are optional — add them later in Crew settings.
            </p>
            <button className="btn-primary w-full" disabled={busy || crewNames.length === 0}
              onClick={() => run(async () => { await addCrewBulk(crewNames); setImported(v => ({ ...v, crew: crewNames.length })) }, 4)}>
              Add {crewNames.length} crew →
            </button>
            <button className="w-full text-center text-sm font-medium cursor-pointer" style={{ minHeight: 44 }} onClick={() => setStep(4)}>
              Skip — I'll add crew later
            </button>
          </section>
        )}

        {tenant && step === 4 && (
          <section className="space-y-4">
            <h1 className="font-semibold" style={{ fontSize: 24 }}>You're live</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              {tenant.name} is on Crewlist
              {imported.races ? ` · ${imported.races} races` : ''}{imported.crew ? ` · ${imported.crew} crew` : ''}.
              Share this link with your crew — they never need an account:
            </p>
            <div className="panel p-3">
              <p className="text-sm break-all font-medium">{publicLink}</p>
              <button className="btn-ghost w-full mt-2" onClick={async () => {
                try { await navigator.clipboard.writeText(publicLink); setCopied(true) } catch { window.prompt('Copy your team link:', publicLink) }
              }}>
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
            </div>
            <button className="btn-primary w-full" onClick={() => navigate(`/t/${tenant.slug}/admin`)}>Open team admin →</button>
            <button className="btn-ghost w-full" onClick={() => navigate(`/t/${tenant.slug}/schedule`)}>View public page</button>
          </section>
        )}
      </main>
    </div>
  )
}
