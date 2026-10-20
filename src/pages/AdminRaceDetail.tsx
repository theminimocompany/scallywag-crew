import { useEffect, useMemo, useState } from 'react'
import {
  fetchRaces, fetchRaceSignups, fetchCrewAll,
  setSignupStatus, removeSignup, addToSelected,
  type Race, type Signup, type Crew,
} from '@/lib/api'
import { Spinner, ErrorBox, DateBlock } from '@/components/bits'
import { FloatingBar } from '@/components/chrome'
import { navigate } from '@/lib/hash'
import { TENANT_SLUG } from '@/lib/config'

type Row = Signup & { crew: Pick<Crew, 'id' | 'name' | 'is_approved'> }

export default function AdminRaceDetail({ raceId }: { raceId: string }) {
  const [race, setRace] = useState<Race | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [crew, setCrew] = useState<Crew[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setErr(null)
    Promise.all([fetchRaces(), fetchRaceSignups(raceId), fetchCrewAll()])
      .then(([rs, su, cr]) => {
        const r = rs.find(x => x.id === raceId)
        if (!r) throw new Error('Race not found')
        setRace(r); setRows(su); setCrew(cr)
      })
      .catch(e => setErr(e.message))
  }
  useEffect(load, [raceId])

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

  async function act(fn: () => Promise<void>, id?: string) {
    if (id) setBusyId(id)
    try { await fn(); await load() }
    catch (e) { setErr((e as Error).message) }
    finally { setBusyId(null) }
  }

  function copyWhatsApp() {
    if (!race || !rows) return
    const when = new Date(race.race_date + 'T00:00:00')
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    const names = selected.map(r => r.crew.name).sort()
    const text = [
      `*${race.name}*`,
      when,
      '',
      names.length > 0 ? `Crew (${names.length}):` : 'No crew selected yet.',
      ...names.map((n, i) => `${i + 1}. ${n}`),
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (err) return <main className="page page-wide py-5 w-full mx-auto"><ErrorBox message={err} onRetry={load} /></main>
  if (!race || !rows || !crew) return <main className="page page-wide py-5 w-full mx-auto"><Spinner /></main>

  return (
    <main className="page page-wide flex-1 py-5 pb-32 space-y-5 fade-in w-full mx-auto">
      <button className="chip cursor-pointer" onClick={() => navigate(`/t/${TENANT_SLUG}/admin/races`)}>
        ← All races
      </button>

      <div className="flex gap-3 items-start">
        <DateBlock iso={race.race_date} />
        <div>
          <h1 className="font-semibold leading-snug" style={{ fontSize: 20 }}>{race.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
            {available.length} available · {selected.length} selected
          </p>
        </div>
      </div>

      {/* Add anyone directly */}
      <section className="space-y-2">
        <h2 className="eyebrow">Add crew to this race</h2>
        <input
          className="input" placeholder="Search crew to add straight to Selected…"
          value={query} onChange={e => setQuery(e.target.value)}
          aria-label="Search crew to add"
        />
        {query && (
          <div className="panel divide-y divide-[hsl(var(--frost))]">
            {addable.map(c => (
              <button key={c.id} className="checkrow" onClick={() => act(() => addToSelected(raceId, c.id))}>
                <span className="font-medium flex-1">{c.name}</span>
                <span className="chip chip-on" style={{ minHeight: 26, fontSize: 12 }}>+ Select</span>
              </button>
            ))}
            {addable.length === 0 && (
              <p className="p-3 text-sm text-center" style={{ color: 'hsl(var(--slate))' }}>
                No matching crew — everyone matching is already on this race.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Available */}
        <section className="space-y-2">
          <h2 className="eyebrow">Available · {available.length}</h2>
          {available.length > 0 && (
          <div className="panel divide-y divide-[hsl(var(--frost))]">
            {available.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3" style={{ minHeight: 48 }}>
                <span className="flex-1 min-w-0 font-medium truncate">
                  {r.crew.name}
                  {!r.crew.is_approved && <span className="badge-new ml-2">new</span>}
                </span>
                <button
                  className="chip chip-on cursor-pointer" style={{ minHeight: 30, fontSize: 12.5 }}
                  disabled={busyId === r.id}
                  onClick={() => act(() => setSignupStatus(r.id, 'selected'), r.id)}
                >
                  Select →
                </button>
                <button
                  className="chip cursor-pointer" style={{ minHeight: 30, fontSize: 12.5, color: 'hsl(var(--destructive))' }}
                  disabled={busyId === r.id}
                  onClick={() => { if (window.confirm(`Remove ${r.crew.name} from this race?`)) act(() => removeSignup(r.id), r.id) }}
                  aria-label={`Remove ${r.crew.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          )}
        </section>

        {/* Selected */}
        <section className="space-y-2">
          <h2 className="eyebrow">Selected · {selected.length}</h2>
          {selected.length > 0 && (
          <div className="panel divide-y divide-[hsl(var(--frost))]" style={{ borderColor: 'hsl(var(--royal) / 0.35)' }}>
            {selected.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3" style={{ minHeight: 48 }}>
                <span className="dot flex-none" style={{ width: 7, height: 7, borderRadius: 999, background: 'hsl(var(--royal))' }} aria-hidden />
                <span className="flex-1 min-w-0 font-medium truncate">{r.crew.name}</span>
                <button
                  className="chip cursor-pointer" style={{ minHeight: 30, fontSize: 12.5, color: 'hsl(var(--destructive))' }}
                  disabled={busyId === r.id}
                  onClick={() => { if (window.confirm(`Remove ${r.crew.name} from this race?`)) act(() => removeSignup(r.id), r.id) }}
                  aria-label={`Remove ${r.crew.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          )}
        </section>
      </div>

      {/* WhatsApp copy bar */}
      <FloatingBar wide>
        <button
          className="btn-primary w-full"
          style={{ boxShadow: '0 10px 24px hsl(var(--royal) / 0.35)' }}
          onClick={copyWhatsApp}
        >
          {copied ? 'Copied ✓' : `Copy crew list for WhatsApp (${selected.length})`}
        </button>
      </FloatingBar>
    </main>
  )
}
