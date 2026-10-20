import { useEffect, useState } from 'react'
import { fetchRaces, parseRhkycCsv, addRace, type CsvRace, type Race } from '@/lib/api'
import { Spinner, ErrorBox } from '@/components/bits'

export default function AdminImport() {
  const [existing, setExisting] = useState<Race[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<CsvRace[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    fetchRaces().then(setExisting).catch(e => setErr(e.message))
  }, [])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !existing) return
    setFileName(f.name)
    setDone(null)
    setErr(null)
    f.text().then(text => {
      try { setRows(parseRhkycCsv(text, existing)) }
      catch (e2) { setErr((e2 as Error).message); setRows(null) }
    })
  }

  const chosen = rows?.filter(r => r.include) ?? []

  async function runImport() {
    if (!rows) return
    setBusy(true)
    setErr(null)
    try {
      for (const r of chosen) {
        await addRace(r.name, r.date)   // sequential: keeps failures attributable
      }
      setDone(chosen.length)
      setRows(null)
      setExisting(await fetchRaces())
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="page page-wide flex-1 py-5 space-y-5 fade-in w-full mx-auto">
      <div>
        <h1 className="font-semibold" style={{ fontSize: 22 }}>Import race calendar</h1>
        <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
          Upload the RHKYC calendar CSV (Google Calendar export: Subject, Start Date DD/MM/YYYY, Location…).
          Race-management duty rows and races you already have are left out automatically.
        </p>
      </div>

      {err && <ErrorBox message={err} />}

      {!existing && !err && <Spinner />}

      {existing && (
        <label className="panel p-6 text-center block cursor-pointer hover:bg-[hsl(var(--tint))] transition-colors">
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          <span className="font-medium">Choose CSV file</span>
          <span className="block text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
            {fileName || 'rhkyc-ruffian-calendar.csv'}
          </span>
        </label>
      )}

      {rows && (
        <>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            {rows.length} rows parsed · <strong className="text-foreground">{chosen.length} to import</strong> ·{' '}
            {rows.filter(r => r.duplicate).length} duplicates skipped ·{' '}
            {rows.filter(r => /race management/i.test(r.name)).length} duty rows skipped.
            Untick anything you don't want.
          </p>
          <div className="panel divide-y divide-[hsl(var(--frost))] max-h-96 overflow-y-auto">
            {rows.map((r, i) => (
              <label key={i} className="checkrow" style={r.duplicate ? { opacity: 0.45 } : {}}>
                <input
                  type="checkbox" className="check" checked={r.include}
                  onChange={() => setRows(rs => rs!.map((x, j) => j === i ? { ...x, include: !x.include } : x))}
                />
                <span className="mono text-sm flex-none" style={{ width: 86, color: 'hsl(var(--slate))' }}>{r.date}</span>
                <span className="flex-1 min-w-0 truncate font-medium">{r.name}</span>
                {r.duplicate && <span className="chip flex-none" style={{ minHeight: 24, fontSize: 11.5 }}>have it</span>}
              </label>
            ))}
          </div>
          <button className="btn-primary w-full" disabled={busy || chosen.length === 0} onClick={runImport}>
            {busy ? `Importing…` : `Import ${chosen.length} race${chosen.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      {done !== null && (
        <div className="panel p-6 text-center fade-in">
          <p className="font-medium">Imported {done} race{done === 1 ? '' : 's'} ✓</p>
          <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>They're live on the public schedule and signup form now.</p>
        </div>
      )}
    </main>
  )
}
