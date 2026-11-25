import { useEffect, useState } from 'react'
import { fetchRaces, parseRhkycCsv, addRace, isValidTimeInput, type CsvRace, type Race } from '@/lib/api'
import { TimeInput } from '@/components/bits'
import { ClButton, ClNotice, ClPageHeader, ClSkeleton, ClStatus } from '@/components/CrewlistUI'
import { previewCsvRows, previewRaces } from '@/pages/adminPreviewData'

export type AdminImportPreview = 'default' | 'loading' | 'error' | 'parsed' | 'invalid' | 'done'

export default function AdminImport({ preview }: { preview?: AdminImportPreview }) {
  const [existing, setExisting] = useState<Race[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? [...previewRaces] : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic calendar load failure.' : null)
  const [rows, setRows] = useState<CsvRace[] | null>(() => preview === 'parsed' || preview === 'invalid'
    ? previewCsvRows.map((row, index) => ({ ...row, startTime: preview === 'invalid' && index === 0 ? '25:99' : row.startTime }))
    : null)
  const [fileName, setFileName] = useState(preview === 'parsed' || preview === 'invalid' ? 'synthetic-rhkyc-calendar.csv' : '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(preview === 'done' ? 2 : null)

  useEffect(() => {
    if (!preview) fetchRaces().then(setExisting).catch(e => setErr(e.message))
  }, [preview])

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
      const invalid = chosen.find(r => !isValidTimeInput(r.startTime))
      if (invalid) {
        throw new Error(`Invalid Start Time "${invalid.startTime}" for "${invalid.name}" — use 24-hour HH:MM, for example 13:45.`)
      }
      if (preview) {
        setDone(chosen.length)
        setRows(null)
        return
      }
      for (const r of chosen) {
        await addRace(r.name, r.date, { startTime: r.startTime, location: r.location })
      }
      setDone(chosen.length)
      setRows(null)
      setExisting(await fetchRaces())
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="cl-container cl-admin-main">
      <ClPageHeader
        eyebrow="RHKYC calendar"
        title="Import race calendar"
        description="Upload a Google Calendar CSV with Subject, Start Date (DD/MM/YYYY), Start Time and Location. Duplicates and race-management duty rows are excluded automatically."
      />

      {err && <ClNotice tone="error" title="Import needs attention">{err}</ClNotice>}
      {!existing && !err && <div className="cl-panel cl-admin-state"><ClSkeleton rows={2} label="Loading existing races" /></div>}

      {existing && (
        <label className="cl-file-drop cl-admin-file-drop">
          <input type="file" accept=".csv,text/csv" className="cl-sr-only" onChange={onFile} />
          <span className="cl-file-drop__icon" aria-hidden="true">↑</span>
          <strong>Choose RHKYC CSV file</strong>
          <span>{fileName || 'Subject, Start Date, Start Time and Location columns'}</span>
        </label>
      )}

      {done !== null && (
        <ClNotice tone="success" title={`Imported ${done} race${done === 1 ? '' : 's'}`}>{preview ? 'Synthetic preview only — no races were created or changed.' : 'They\'re live on the public schedule and signup form now.'}</ClNotice>
      )}

      {rows && (
        <section className="cl-admin-import-review">
          <div className="cl-admin-import-summary">
            <div><strong>{chosen.length}</strong><span>to import</span></div>
            <div><strong>{rows.length}</strong><span>rows parsed</span></div>
            <div><strong>{rows.filter(r => r.duplicate).length}</strong><span>duplicates skipped</span></div>
            <div><strong>{rows.filter(r => /race management/i.test(r.name)).length}</strong><span>duty rows skipped</span></div>
          </div>
          <p className="cl-admin-help">Review each row and untick anything you do not want. Start time and location are optional.</p>
          <div className="cl-panel cl-admin-import-list">
            {rows.map((r, i) => (
              <div key={`${r.date}-${r.name}`} className={`cl-admin-import-row ${r.duplicate ? 'cl-admin-import-row--duplicate' : ''}`}>
                <div className="cl-admin-import-row__top">
                  <input
                    type="checkbox" className="cl-admin-check" checked={r.include} disabled={busy}
                    aria-label={`Include ${r.name}`}
                    onChange={() => setRows(rs => rs!.map((x, j) => j === i ? { ...x, include: !x.include } : x))}
                  />
                  <span className="cl-mono">{r.date}</span>
                  <strong>{r.name}</strong>
                  {r.duplicate && <ClStatus>Already added</ClStatus>}
                  {!r.duplicate && !r.include && <ClStatus tone="warning">Excluded</ClStatus>}
                </div>
                {r.include && (
                  <div className="cl-admin-import-row__fields">
                    <label className="cl-field">
                      <span className="cl-field__label-row"><span className="cl-label">Start time</span><span className="cl-field__optional">Optional</span></span>
                      <TimeInput
                        value={r.startTime} disabled={busy}
                        ariaLabel={`Start time for ${r.name}, optional, 24-hour HH:MM`}
                        onChange={value => setRows(rs => rs!.map((x, j) => j === i ? { ...x, startTime: value } : x))}
                      />
                      <span className="cl-field__hint">24-hour HH:MM</span>
                    </label>
                    <label className="cl-field">
                      <span className="cl-field__label-row"><span className="cl-label">Location</span><span className="cl-field__optional">Optional</span></span>
                      <input
                        className="cl-input" value={r.location} disabled={busy} placeholder="e.g. Victoria Harbour"
                        aria-label={`Location for ${r.name}, optional`}
                        onChange={e => setRows(rs => rs!.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="cl-admin-import-action"><ClButton full loading={busy} disabled={chosen.length === 0} onClick={runImport}>Import {chosen.length} race{chosen.length === 1 ? '' : 's'}</ClButton></div>
        </section>
      )}
    </main>
  )
}
