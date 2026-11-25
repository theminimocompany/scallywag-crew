import { useEffect, useMemo, useState } from 'react'
import {
  fetchRaces, fetchAllSignups, addRace,
  groupByMonth, type Race, type Signup,
} from '@/lib/api'
import { DateBlock, RaceMeta, TimeInput } from '@/components/bits'
import { ClButton, ClEmpty, ClInput, ClNotice, ClPageHeader, ClSkeleton, ClStatus } from '@/components/CrewlistUI'
import { navigate } from '@/lib/hash'
import { currentTenantSlug } from '@/lib/tenant'
import { previewRaces, previewSignups } from '@/pages/adminPreviewData'

export type AdminRacesPreview = 'default' | 'loading' | 'error' | 'empty' | 'add'

export default function AdminRaces({ preview }: { preview?: AdminRacesPreview }) {
  const [races, setRaces] = useState<Race[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? (preview === 'empty' ? [] : [...previewRaces]) : null)
  const [signups, setSignups] = useState<Signup[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? (preview === 'empty' ? [] : [...previewSignups]) : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic race calendar load failure.' : null)
  const [showPast, setShowPast] = useState(false)
  const [adding, setAdding] = useState(preview === 'add')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (preview) {
      setErr(null)
      setRaces(preview === 'empty' ? [] : [...previewRaces])
      setSignups(preview === 'empty' ? [] : [...previewSignups])
      return
    }
    setErr(null)
    Promise.all([fetchRaces(), fetchAllSignups()])
      .then(([r, s]) => { setRaces(r); setSignups(s) })
      .catch(e => setErr(e.message))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!preview) load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const counts = useMemo(() => {
    const m = new Map<string, { a: number; s: number }>()
    for (const su of signups ?? []) {
      const c = m.get(su.race_id) ?? { a: 0, s: 0 }
      if (su.status === 'available') c.a++; else c.s++
      m.set(su.race_id, c)
    }
    return m
  }, [signups])

  const visible = useMemo(() => {
    if (!races) return []
    return showPast ? races : races.filter(r => r.race_date >= today)
  }, [races, showPast, today])

  function openRace(id: string) {
    navigate(preview ? `/mockups/admin/race-detail/default` : `/t/${currentTenantSlug()}/admin/races/${id}`)
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return
    setBusy(true)
    try {
      if (preview) {
        const race: Race = {
          id: `preview-added-${date}`,
          tenant_id: previewRaces[0].tenant_id,
          name: name.trim(),
          race_date: date,
          start_time: startTime || null,
          location: location.trim() || null,
          is_hidden: false,
          signup_closed: false,
        }
        setRaces(current => [...(current ?? []), race].sort((a, b) => a.race_date.localeCompare(b.race_date)))
      } else {
        await addRace(name.trim(), date, { startTime, location })
      }
      setName(''); setDate(''); setStartTime(''); setLocation(''); setAdding(false)
      if (!preview) load()
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="cl-container cl-admin-main">
      <ClPageHeader
        eyebrow="Race management"
        title="Races"
        description="Open a race to select crew, remove sign-ups or copy the WhatsApp list."
        actions={<>
          <ClButton variant="secondary" onClick={() => setShowPast(v => !v)}>{showPast ? 'Hide past' : 'Show past'}</ClButton>
          <ClButton variant={adding ? 'secondary' : 'primary'} onClick={() => setAdding(v => !v)}>{adding ? 'Cancel' : 'Add race'}</ClButton>
        </>}
      />

      {adding && (
        <form onSubmit={submitAdd} className="cl-panel cl-admin-form">
          <div className="cl-admin-section-heading">
            <div><p className="cl-eyebrow">New calendar entry</p><h2>Add a race</h2></div>
            <p>Only the name and date are required.</p>
          </div>
          <div className="cl-admin-form-grid">
            <ClInput id="admin-race-name" className="cl-admin-span-2" label="Race name" placeholder="e.g. Winter Series — Race 5" value={name} onChange={e => setName(e.target.value)} required />
            <ClInput id="admin-race-date" label="Race date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <label className="cl-field">
              <span className="cl-field__label-row"><span className="cl-label">Start time</span><span className="cl-field__optional">Optional</span></span>
              <TimeInput value={startTime} onChange={setStartTime} ariaLabel="Race start time, optional, 24-hour HH:MM" />
              <span className="cl-field__hint">24-hour time (HH:MM)</span>
            </label>
            <ClInput id="admin-race-location" className="cl-admin-span-2" label="Location" optional placeholder="e.g. Victoria Harbour" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="cl-admin-form-actions"><ClButton loading={busy} type="submit">Save race</ClButton></div>
        </form>
      )}

      {err && <ClNotice tone="error" title="Could not load races" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice>}
      {!err && (!races || !signups) && <div className="cl-panel cl-admin-state"><ClSkeleton rows={4} label="Loading admin races" /></div>}
      {races && signups && visible.length === 0 && (
        <div className="cl-panel"><ClEmpty title="No races here" hint="Add one manually or import the season calendar from the Import tab." action={<ClButton onClick={() => setAdding(true)}>Add race</ClButton>} /></div>
      )}

      <div className="cl-admin-months">
        {races && signups && groupByMonth(visible).map(([month, rs]) => (
          <section key={month} className="cl-admin-month">
            <h2>{month}</h2>
            <div className="cl-panel cl-admin-race-panel">
              {rs.map(r => {
                const c = counts.get(r.id) ?? { a: 0, s: 0 }
                const past = r.race_date < today
                return (
                  <button key={r.id} className="cl-admin-race-row" onClick={() => openRace(r.id)}>
                    <DateBlock iso={r.race_date} />
                    <span className={`cl-admin-race-row__content ${past ? 'cl-admin-past' : ''}`}>
                      <strong>{r.name}</strong>
                      <RaceMeta startTime={r.start_time} location={r.location} />
                    </span>
                    <span className="cl-admin-race-row__counts">
                      <ClStatus>{c.a} available</ClStatus>
                      <ClStatus tone="selected">{c.s} selected</ClStatus>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
