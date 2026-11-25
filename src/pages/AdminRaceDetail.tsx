import { useEffect, useMemo, useState } from 'react'
import {
  fetchRaces, fetchRaceSignups, fetchCrewAll,
  setSignupStatus, removeSignup, addToSelected, updateRaceDetails, deleteRace,
  isValidTimeInput, type Race, type Signup, type Crew,
} from '@/lib/api'
import { DateBlock, RaceMeta, TimeInput } from '@/components/bits'
import { FloatingBar } from '@/components/chrome'
import { ClButton, ClEmpty, ClInput, ClNotice, ClPageHeader, ClSkeleton, ClStatus } from '@/components/CrewlistUI'
import { navigate } from '@/lib/hash'
import { currentTenantSlug } from '@/lib/tenant'
import { previewCrew, previewRaceRows, previewRaces } from '@/pages/adminPreviewData'

type Row = Signup & { crew: Pick<Crew, 'id' | 'name' | 'is_approved'> }
export type AdminRaceDetailPreview = 'default' | 'loading' | 'error' | 'edit' | 'empty'

export default function AdminRaceDetail({ raceId, preview }: { raceId: string; preview?: AdminRaceDetailPreview }) {
  const [race, setRace] = useState<Race | null>(() => preview && preview !== 'loading' && preview !== 'error' ? { ...previewRaces[0] } : null)
  const [rows, setRows] = useState<Row[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? (preview === 'empty' ? [] : previewRaceRows.map(row => ({ ...row, crew: { ...row.crew } }))) : null)
  const [crew, setCrew] = useState<Crew[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? previewCrew.map(person => ({ ...person })) : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic race detail load failure.' : null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState(preview === 'edit')
  const [editName, setEditName] = useState(preview === 'edit' ? previewRaces[0].name : '')
  const [editDate, setEditDate] = useState(preview === 'edit' ? previewRaces[0].race_date : '')
  const [editTime, setEditTime] = useState(preview === 'edit' ? previewRaces[0].start_time ?? '' : '')
  const [editLocation, setEditLocation] = useState(preview === 'edit' ? previewRaces[0].location ?? '' : '')
  const [editBusy, setEditBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)

  const load = () => {
    if (preview) {
      setErr(null)
      setRace({ ...previewRaces[0] })
      setRows(preview === 'empty' ? [] : previewRaceRows.map(row => ({ ...row, crew: { ...row.crew } })))
      setCrew(previewCrew.map(person => ({ ...person })))
      return
    }
    setErr(null)
    Promise.all([fetchRaces(), fetchRaceSignups(raceId), fetchCrewAll()])
      .then(([rs, su, cr]) => {
        const r = rs.find(x => x.id === raceId)
        if (!r) throw new Error('Race not found')
        setRace(r); setRows(su); setCrew(cr)
      })
      .catch(e => setErr(e.message))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!preview) load() }, [raceId])

  const available = useMemo(() => (rows ?? []).filter(r => r.status === 'available'), [rows])
  const selected = useMemo(() => (rows ?? []).filter(r => r.status === 'selected'), [rows])

  const addable = useMemo(() => {
    if (!crew || !rows) return []
    const inRace = new Set(rows.map(r => r.crew_id))
    const q = query.trim().toLowerCase()
    return crew
      .filter(c => c.is_approved && !inRace.has(c.id))
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [crew, rows, query])

  async function act(fn: () => Promise<void>, id?: string, previewAction?: () => void) {
    if (id) setBusyId(id)
    try {
      if (preview) previewAction?.()
      else { await fn(); await load() }
    } catch (e) { setErr((e as Error).message) }
    finally { setBusyId(null) }
  }

  function beginEdit() {
    if (!race) return
    setEditName(race.name)
    setEditDate(race.race_date)
    setEditTime(race.start_time?.slice(0, 5) ?? '')
    setEditLocation(race.location ?? '')
    setEditErr(null)
    setEditing(true)
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !editDate) return
    setEditBusy(true)
    setEditErr(null)
    try {
      if (!isValidTimeInput(editTime)) throw new Error('Start time must use 24-hour HH:MM, for example 13:45.')
      if (preview) {
        setRace(current => current ? { ...current, name: editName.trim(), race_date: editDate, start_time: editTime || null, location: editLocation.trim() || null } : current)
      } else {
        await updateRaceDetails(raceId, {
          name: editName,
          raceDate: editDate,
          startTime: editTime,
          location: editLocation,
        })
      }
      setEditing(false)
      if (!preview) await load()
    } catch (e2) {
      setEditErr((e2 as Error).message)
    } finally {
      setEditBusy(false)
    }
  }

  async function removeRace() {
    if (!race || !rows) return
    const signupCount = rows.length
    const confirmed = window.confirm(
      `Delete "${race.name}" (${race.race_date})?\n` +
      `${signupCount} sign-up${signupCount === 1 ? '' : 's'} will also be removed.\n` +
      'This cannot be undone.',
    )
    if (!confirmed) return
    setDeleteBusy(true)
    setEditErr(null)
    try {
      if (preview) navigate('/mockups/admin/races/default')
      else {
        await deleteRace(race.id)
        navigate(`/t/${currentTenantSlug()}/admin/races`)
      }
    } catch (e2) {
      setEditErr((e2 as Error).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  function copyWhatsApp() {
    if (!race || !rows) return
    const when = new Date(race.race_date + 'T00:00:00')
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    const names = selected.map(r => r.crew.name).sort()
    const time = race.start_time?.slice(0, 5)
    const text = [
      `*${race.name}*`,
      `${when}${time ? ` · ${time}` : ''}`,
      ...(race.location?.trim() ? [race.location.trim()] : []),
      '',
      names.length > 0 ? `Crew (${names.length}):` : 'No crew selected yet.',
      ...names.map((n, i) => `${i + 1}. ${n}`),
    ].join('\n')
    if (preview) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      return
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (err) return <main className="cl-container cl-admin-main"><ClNotice tone="error" title="Could not load race" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice></main>
  if (!race || !rows || !crew) return <main className="cl-container cl-admin-main"><div className="cl-panel cl-admin-state"><ClSkeleton rows={5} label="Loading race crew" /></div></main>

  return (
    <main className="cl-container cl-admin-main cl-admin-race-detail">
      <div className="cl-admin-back"><ClButton variant="text" onClick={() => navigate(preview ? '/mockups/admin/races/default' : `/t/${currentTenantSlug()}/admin/races`)}>← All races</ClButton></div>
      <ClPageHeader
        eyebrow="Race crew"
        title={race.name}
        actions={<ClButton variant="secondary" onClick={beginEdit}>Edit race details</ClButton>}
      />
      <div className="cl-admin-race-detail-meta">
        <DateBlock iso={race.race_date} />
        <RaceMeta startTime={race.start_time} location={race.location} />
      </div>

      {editing && (
        <form className="cl-panel cl-admin-form" onSubmit={saveDetails}>
          <div className="cl-admin-section-heading">
            <div><p className="cl-eyebrow">Calendar entry</p><h2>Edit race details</h2></div>
            <p>Start time and location are optional.</p>
          </div>
          <div className="cl-admin-form-grid">
            <ClInput id="edit-race-name" className="cl-admin-span-2" label="Race name" value={editName} onChange={e => setEditName(e.target.value)} required />
            <ClInput id="edit-race-date" label="Race date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
            <label className="cl-field">
              <span className="cl-field__label-row"><span className="cl-label">Start time</span><span className="cl-field__optional">Optional</span></span>
              <TimeInput value={editTime} onChange={setEditTime} ariaLabel="Race start time, optional, 24-hour HH:MM" />
              <span className="cl-field__hint">24-hour time (HH:MM)</span>
            </label>
            <ClInput id="edit-race-location" className="cl-admin-span-2" label="Location" optional placeholder="e.g. Victoria Harbour" value={editLocation} onChange={e => setEditLocation(e.target.value)} />
          </div>
          {editErr && <ClNotice tone="error" title="Changes not saved">{editErr}</ClNotice>}
          <div className="cl-admin-edit-actions">
            <div>
              <ClButton type="submit" loading={editBusy} disabled={deleteBusy}>Save changes</ClButton>
              <ClButton variant="secondary" disabled={editBusy || deleteBusy} onClick={() => setEditing(false)}>Cancel</ClButton>
            </div>
            <ClButton variant="danger" disabled={editBusy} loading={deleteBusy} onClick={removeRace}>Delete race</ClButton>
          </div>
        </form>
      )}

      <section className="cl-admin-search-section">
        <ClInput id="race-crew-search" label="Search approved crew" placeholder="Type a crew name…" value={query} onChange={e => setQuery(e.target.value)} />
        {query && (
          <div className="cl-panel cl-admin-search-results">
            {addable.map(c => (
              <button key={c.id} className="cl-admin-person-row" onClick={() => act(
                () => addToSelected(raceId, c.id),
                undefined,
                () => {
                  const row: Row = { id: `preview-signup-${c.id}`, tenant_id: c.tenant_id, race_id: raceId, crew_id: c.id, status: 'selected', source: 'admin', created_at: '2026-11-25T00:00:00Z', crew: { id: c.id, name: c.name, is_approved: c.is_approved } }
                  setRows(current => [...(current ?? []), row])
                  setQuery('')
                },
              )}>
                <span><strong>{c.name}</strong><small>Approved crew</small></span>
                <ClStatus tone="selected">+ Select</ClStatus>
              </button>
            ))}
            {addable.length === 0 && <ClEmpty title="No matching crew" hint="Everyone matching this search is already on the race." />}
          </div>
        )}
      </section>

      <div className="cl-admin-crew-columns">
        <section>
          <div className="cl-admin-section-heading cl-admin-section-heading--compact"><div><p className="cl-eyebrow">Sign-ups</p><h2>Available · {available.length}</h2></div></div>
          <div className="cl-panel cl-admin-person-list">
            {available.length === 0 && <ClEmpty title="Nobody available" />}
            {available.map(r => (
              <div key={r.id} className="cl-admin-person-row">
                <span><strong>{r.crew.name}</strong>{!r.crew.is_approved && <small>Pending review</small>}</span>
                <div className="cl-admin-row-actions">
                  <ClButton size="small" variant="secondary" disabled={busyId === r.id} onClick={() => act(() => setSignupStatus(r.id, 'selected'), r.id, () => setRows(current => (current ?? []).map(row => row.id === r.id ? { ...row, status: 'selected' } : row)))}>Select</ClButton>
                  <ClButton size="small" variant="danger" disabled={busyId === r.id} aria-label={`Remove ${r.crew.name}`} onClick={() => { if (window.confirm(`Remove ${r.crew.name} from this race?`)) act(() => removeSignup(r.id), r.id, () => setRows(current => (current ?? []).filter(row => row.id !== r.id))) }}>×</ClButton>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="cl-admin-section-heading cl-admin-section-heading--compact"><div><p className="cl-eyebrow">Final crew</p><h2>Selected · {selected.length}</h2></div></div>
          <div className="cl-panel cl-admin-person-list cl-admin-person-list--selected">
            {selected.length === 0 && <ClEmpty title="No crew selected" />}
            {selected.map(r => (
              <div key={r.id} className="cl-admin-person-row">
                <span><strong>{r.crew.name}</strong></span>
                <div className="cl-admin-row-actions">
                  <ClButton size="small" variant="secondary" disabled={busyId === r.id} aria-label={`Deselect ${r.crew.name}`} onClick={() => act(() => setSignupStatus(r.id, 'available'), r.id, () => setRows(current => (current ?? []).map(row => row.id === r.id ? { ...row, status: 'available' } : row)))}>Deselect</ClButton>
                  <ClButton size="small" variant="danger" disabled={busyId === r.id} aria-label={`Remove ${r.crew.name}`} onClick={() => { if (window.confirm(`Remove ${r.crew.name} from this race?`)) act(() => removeSignup(r.id), r.id, () => setRows(current => (current ?? []).filter(row => row.id !== r.id))) }}>×</ClButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!editing && (
        <FloatingBar wide crewlist>
          <ClButton full onClick={copyWhatsApp}>{copied ? 'Copied ✓' : `Copy crew list for WhatsApp (${selected.length})`}</ClButton>
        </FloatingBar>
      )}
    </main>
  )
}
