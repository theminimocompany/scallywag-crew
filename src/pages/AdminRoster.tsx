import { useEffect, useMemo, useState } from 'react'
import {
  fetchCrewAll, fetchCrewHistory, fetchAllSignups,
  approveCrew, updateCrew, addCrew, deleteCrew,
  type Crew, type Signup, type Race,
} from '@/lib/api'
import { Spinner, Empty, ErrorBox } from '@/components/bits'

type HistoryRow = Signup & { races: Pick<Race, 'id' | 'name' | 'race_date'> }

export default function AdminRoster({ crewId }: { crewId?: string }) {
  const [crew, setCrew] = useState<Crew[] | null>(null)
  const [signups, setSignups] = useState<Signup[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<Crew | null>(null)
  const [history, setHistory] = useState<HistoryRow[] | null>(null)
  const [histFilter, setHistFilter] = useState<'all' | 'available' | 'selected'>('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '' })
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<'decline' | 'delete' | null>(null)

  const load = () => {
    setErr(null)
    Promise.all([fetchCrewAll(), fetchAllSignups()])
      .then(([c, s]) => { setCrew(c); setSignups(s) })
      .catch(e => setErr(e.message))
  }
  useEffect(load, [])

  // deep-link: open detail when crewId present
  useEffect(() => {
    if (crewId && crew) {
      const c = crew.find(x => x.id === crewId)
      if (c) openDetail(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, crew])

  const counts = useMemo(() => {
    const m = new Map<string, { a: number; s: number }>()
    for (const su of signups ?? []) {
      const c = m.get(su.crew_id) ?? { a: 0, s: 0 }
      if (su.status === 'available') c.a++; else c.s++
      m.set(su.crew_id, c)
    }
    return m
  }, [signups])

  const filtered = useMemo(() => {
    if (!crew) return []
    const q = query.trim().toLowerCase()
    const list = q ? crew.filter(c => c.name.toLowerCase().includes(q)) : crew
    // pending approvals float to the top
    return [...list].sort((a, b) => Number(a.is_approved) - Number(b.is_approved) || a.name.localeCompare(b.name))
  }, [crew, query])

  function openDetail(c: Crew) {
    setDetail(c)
    setHistory(null)
    setHistFilter('all')
    setConfirming(null)
    fetchCrewHistory(c.id).then(setHistory).catch(e => setErr(e.message))
  }

  async function doDelete() {
    if (!detail) return
    setBusy(true)
    try {
      await deleteCrew(detail.id)
      await load()
      setDetail(null)
      setConfirming(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function saveDetail() {
    if (!detail) return
    setBusy(true)
    try {
      await updateCrew(detail.id, {
        name: detail.name.trim(),
        phone: detail.phone || null,
        emergency_contact_name: detail.emergency_contact_name || null,
        emergency_contact_phone: detail.emergency_contact_phone || null,
        notes: detail.notes || null,
      })
      await load()
      setDetail(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) return
    setBusy(true)
    try {
      await addCrew({
        name: form.name.trim(),
        phone: form.phone || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
      })
      setAdding(false); setForm({ name: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '' })
      load()
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  const histVisible = useMemo(() => {
    if (!history) return []
    return history
      .filter(h => histFilter === 'all' || h.status === histFilter)
      .sort((a, b) => (b.races?.race_date ?? '').localeCompare(a.races?.race_date ?? ''))
  }, [history, histFilter])

  if (err && !crew) return <main className="page page-wide py-5 w-full mx-auto"><ErrorBox message={err} onRetry={load} /></main>

  // ---------- person detail (history filter — the extra feature) ----------
  if (detail) {
    const c = counts.get(detail.id) ?? { a: 0, s: 0 }
    return (
      <main className="page page-wide flex-1 py-5 space-y-5 fade-in w-full mx-auto">
        <button className="chip cursor-pointer" onClick={() => setDetail(null)}>← All crew</button>

        <div className="panel p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-semibold" style={{ fontSize: 20 }}>{detail.name}</h1>
            {!detail.is_approved && <span className="badge-new">new — pending review</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">Name</span>
              <input className="input mt-1" value={detail.name} onChange={e => setDetail({ ...detail, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="eyebrow">Phone</span>
              <input className="input mt-1" value={detail.phone ?? ''} onChange={e => setDetail({ ...detail, phone: e.target.value })} />
            </label>
            <label className="block">
              <span className="eyebrow">Emergency contact</span>
              <input className="input mt-1" value={detail.emergency_contact_name ?? ''} onChange={e => setDetail({ ...detail, emergency_contact_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="eyebrow">Emergency phone</span>
              <input className="input mt-1" value={detail.emergency_contact_phone ?? ''} onChange={e => setDetail({ ...detail, emergency_contact_phone: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" disabled={busy} onClick={saveDetail}>{busy ? 'Saving…' : 'Save details'}</button>
            {!detail.is_approved && (
              <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); await approveCrew(detail.id); await load(); setDetail(null); setBusy(false) }}>
                Approve to public crew list
              </button>
            )}
            {!detail.is_approved && (
              <button className="btn-ghost" disabled={busy} style={{ color: 'hsl(var(--destructive))' }} onClick={() => setConfirming('decline')}>
                Decline
              </button>
            )}
            <button className="btn-danger" disabled={busy} onClick={() => setConfirming('delete')}>
              Delete crew
            </button>
          </div>

          {confirming && (
            <div className="panel p-4 space-y-3 fade-in" style={{ borderColor: 'hsl(var(--destructive) / 0.45)' }} role="alertdialog" aria-label="Confirm deletion">
              <p className="text-sm font-medium">
                {confirming === 'decline'
                  ? `Decline ${detail.name}'s registration?`
                  : `Delete ${detail.name}?`}
              </p>
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
                {c.a + c.s > 0
                  ? `This permanently removes them and their ${c.a + c.s} signup${c.a + c.s > 1 ? 's' : ''}. This cannot be undone.`
                  : 'This permanently removes them. This cannot be undone.'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-danger" disabled={busy} onClick={doDelete}>
                  {busy ? 'Deleting…' : confirming === 'decline' ? 'Yes, decline' : 'Yes, delete'}
                </button>
                <button className="btn-ghost" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="eyebrow">Race history</h2>
            <div className="flex gap-1" role="tablist" aria-label="History filter">
              {([['all', `All ${c.a + c.s}`], ['selected', `Selected ${c.s}`], ['available', `Available ${c.a}`]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={histFilter === k}
                  className={`chip cursor-pointer ${histFilter === k ? 'chip-on' : ''}`}
                  style={{ minHeight: 28, fontSize: 12 }}
                  onClick={() => setHistFilter(k)}>
                  <span className="dot" aria-hidden />{label}
                </button>
              ))}
            </div>
          </div>
          {!history && <Spinner />}
          {history && histVisible.length === 0 && <Empty title="No races in this view" />}
          {history && histVisible.length > 0 && (
            <div className="panel divide-y divide-[hsl(var(--frost))]">
              {histVisible.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-3" style={{ minHeight: 44 }}>
                  <span className="mono text-sm flex-none" style={{ width: 86, color: 'hsl(var(--slate))' }}>{h.races?.race_date}</span>
                  <span className="flex-1 min-w-0 truncate font-medium">{h.races?.name}</span>
                  <span className={`chip ${h.status === 'selected' ? 'chip-on' : ''}`} style={{ minHeight: 26, fontSize: 12 }}>
                    <span className="dot" aria-hidden />{h.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    )
  }

  // ---------- roster list ----------
  return (
    <main className="page page-wide flex-1 py-5 space-y-5 fade-in w-full mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 22 }}>Crew</h1>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
            Tap a person for contact details and their full race history.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(v => !v)}>{adding ? 'Cancel' : 'Add crew'}</button>
      </div>

      {adding && (
        <form onSubmit={submitAdd} className="panel p-4 grid gap-2 sm:grid-cols-2 fade-in">
          <input className="input" placeholder="Full name" value={form.name} required
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Emergency contact" value={form.emergency_contact_name}
            onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} />
          <input className="input" placeholder="Emergency phone" value={form.emergency_contact_phone}
            onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} />
          <button className="btn-primary sm:col-span-2" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save crew member'}</button>
        </form>
      )}

      <input className="input" placeholder="Search crew…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search crew" />

      {err && <ErrorBox message={err} onRetry={load} />}
      {!err && (!crew || !signups) && <Spinner />}
      {crew && signups && filtered.length === 0 && <Empty title="No crew found" />}

      {crew && signups && (
        <div className="panel divide-y divide-[hsl(var(--frost))]">
          {filtered.map(c => {
            const n = counts.get(c.id) ?? { a: 0, s: 0 }
            return (
              <button key={c.id} className="checkrow" onClick={() => openDetail(c)}>
                <span className="flex-1 min-w-0 text-left">
                  <span className="font-medium block truncate">
                    {c.name}
                    {!c.is_approved && <span className="badge-new ml-2">new</span>}
                  </span>
                  <span className="text-sm block truncate" style={{ color: 'hsl(var(--slate))' }}>
                    {c.phone ?? 'no phone'}
                  </span>
                </span>
                <span className="chip flex-none" style={{ minHeight: 26, fontSize: 12 }}>
                  <span className="dot" aria-hidden />{n.a} avail
                </span>
                <span className="chip chip-on flex-none" style={{ minHeight: 26, fontSize: 12 }}>
                  <span className="dot" aria-hidden />{n.s} sel
                </span>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
