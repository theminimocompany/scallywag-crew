import { useEffect, useMemo, useState } from 'react'
import {
  fetchRaces, fetchAllSignups, addRace, deleteRace,
  groupByMonth, type Race, type Signup,
} from '@/lib/api'
import { Spinner, Empty, ErrorBox, DateBlock, RaceMeta } from '@/components/bits'
import { navigate } from '@/lib/hash'
import { currentTenantSlug } from '@/lib/tenant'

export default function AdminRaces() {
  const [races, setRaces] = useState<Race[] | null>(null)
  const [signups, setSignups] = useState<Signup[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setErr(null)
    Promise.all([fetchRaces(), fetchAllSignups()])
      .then(([r, s]) => { setRaces(r); setSignups(s) })
      .catch(e => setErr(e.message))
  }
  useEffect(load, [])

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

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return
    setBusy(true)
    try {
      await addRace(name.trim(), date, { startTime, location })
      setName(''); setDate(''); setStartTime(''); setLocation(''); setAdding(false)
      load()
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  async function remove(r: Race) {
    if (!window.confirm(`Delete "${r.name}" (${r.race_date})?\nAll signups for this race will be removed.`)) return
    try { await deleteRace(r.id); load() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <main className="page page-wide flex-1 py-5 space-y-5 fade-in w-full mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 22 }}>Races</h1>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
            Tap a race to pick crew from the available list.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowPast(v => !v)}>
            {showPast ? 'Hide past' : 'Show past'}
          </button>
          <button className="btn-primary" onClick={() => setAdding(v => !v)}>
            {adding ? 'Cancel' : 'Add race'}
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={submitAdd} className="panel p-4 space-y-3 fade-in">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">Race name</span>
              <input className="input" placeholder="Race name" value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Race date</span>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required aria-label="Race date" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Start time <span style={{ color: 'hsl(var(--slate))' }}>(optional)</span></span>
              <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} aria-label="Race start time, optional" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">Location <span style={{ color: 'hsl(var(--slate))' }}>(optional)</span></span>
              <input className="input" placeholder="e.g. Victoria Harbour" value={location} onChange={e => setLocation(e.target.value)} />
            </label>
          </div>
          <button className="btn-primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save race'}</button>
        </form>
      )}

      {err && <ErrorBox message={err} onRetry={load} />}
      {!err && (!races || !signups) && <Spinner />}
      {races && signups && visible.length === 0 && (
        <Empty title="No races here" hint="Add one manually or import the season calendar from the Import tab." />
      )}

      {races && signups && groupByMonth(visible).map(([month, rs]) => (
        <section key={month}>
          <h2 className="month-sep">{month}</h2>
          <div className="divide-y divide-[hsl(var(--frost))]">
            {rs.map(r => {
              const c = counts.get(r.id) ?? { a: 0, s: 0 }
              const past = r.race_date < today
              return (
                <div key={r.id} className="flex items-center gap-3 py-3 group">
                  <DateBlock iso={r.race_date} />
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => navigate(`/t/${currentTenantSlug()}/admin/races/${r.id}`)}
                  >
                    <span className={`font-medium leading-snug block ${past ? 'opacity-60' : ''}`}>{r.name}</span>
                    <RaceMeta startTime={r.start_time} location={r.location} />
                    <span className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="chip" style={{ minHeight: 26, fontSize: 12 }}>
                        <span className="dot" aria-hidden />{c.a} available
                      </span>
                      <span className="chip chip-on" style={{ minHeight: 26, fontSize: 12 }}>
                        <span className="dot" aria-hidden />{c.s} selected
                      </span>
                    </span>
                  </button>
                  <button
                    className="chip cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    style={{ minHeight: 26, fontSize: 12, color: 'hsl(var(--destructive))' }}
                    onClick={() => remove(r)}
                    aria-label={`Delete ${r.name}`}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
