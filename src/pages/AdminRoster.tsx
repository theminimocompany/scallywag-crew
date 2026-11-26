import { useEffect, useMemo, useState } from 'react'
import {
  fetchCrewAll, fetchCrewHistory, fetchAllSignups,
  approveCrew, updateCrew, addCrew, deleteCrew,
  type Crew, type Signup, type Race,
} from '@/lib/api'
import { ClButton, ClEmpty, ClInput, ClNotice, ClPageHeader, ClSkeleton, ClStatus, ClTabs } from '@/components/CrewlistUI'
import { previewCrew, previewHistory, previewSignups } from '@/pages/adminPreviewData'

type HistoryRow = Signup & { races: Pick<Race, 'id' | 'name' | 'race_date'> }
export type AdminRosterPreview = 'default' | 'loading' | 'error' | 'empty' | 'add' | 'detail' | 'delete' | 'pending'

export default function AdminRoster({ crewId, preview }: { crewId?: string; preview?: AdminRosterPreview }) {
  const detailedPreview = preview === 'detail' || preview === 'delete' || preview === 'pending'
  const initialDetail = detailedPreview ? (preview === 'pending' ? previewCrew[3] : previewCrew[0]) : null
  const [crew, setCrew] = useState<Crew[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? (preview === 'empty' ? [] : previewCrew.map(person => ({ ...person }))) : null)
  const [signups, setSignups] = useState<Signup[] | null>(() => preview && preview !== 'loading' && preview !== 'error' ? (preview === 'empty' ? [] : [...previewSignups]) : null)
  const [err, setErr] = useState<string | null>(preview === 'error' ? 'Synthetic crew load failure.' : null)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<Crew | null>(initialDetail ? { ...initialDetail } : null)
  const [history, setHistory] = useState<HistoryRow[] | null>(() => detailedPreview ? previewHistory.filter(row => row.crew_id === initialDetail?.id).map(row => ({ ...row, races: { ...row.races } })) : null)
  const [histFilter, setHistFilter] = useState<'all' | 'available' | 'selected'>('all')
  const [adding, setAdding] = useState(preview === 'add')
  const [form, setForm] = useState({ name: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '' })
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<'decline' | 'delete' | null>(preview === 'delete' ? 'delete' : null)

  const load = () => {
    if (preview) {
      setErr(null)
      setCrew(preview === 'empty' ? [] : previewCrew.map(person => ({ ...person })))
      setSignups(preview === 'empty' ? [] : [...previewSignups])
      return
    }
    setErr(null)
    Promise.all([fetchCrewAll(), fetchAllSignups()])
      .then(([c, s]) => { setCrew(c); setSignups(s) })
      .catch(e => setErr(e.message))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!preview) load() }, [])

  useEffect(() => {
    if (!preview && crewId && crew) {
      const c = crew.find(x => x.id === crewId)
      if (c) openDetail(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, crew, preview])

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
    return [...list].sort((a, b) => Number(a.is_approved) - Number(b.is_approved) || a.name.localeCompare(b.name))
  }, [crew, query])

  function openDetail(c: Crew) {
    setDetail(c)
    setHistory(null)
    setHistFilter('all')
    setConfirming(null)
    if (preview) {
      setHistory(previewHistory.filter(row => row.crew_id === c.id).map(row => ({ ...row, races: { ...row.races } })))
      return
    }
    fetchCrewHistory(c.id).then(setHistory).catch(e => setErr(e.message))
  }

  async function doDelete() {
    if (!detail) return
    setBusy(true)
    try {
      if (preview) {
        setCrew(current => (current ?? []).filter(person => person.id !== detail.id))
        setSignups(current => (current ?? []).filter(row => row.crew_id !== detail.id))
      } else {
        await deleteCrew(detail.id)
        await load()
      }
      setDetail(null)
      setConfirming(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function saveDetail() {
    if (!detail) return
    setBusy(true)
    try {
      if (preview) {
        setCrew(current => (current ?? []).map(person => person.id === detail.id ? { ...detail, name: detail.name.trim() } : person))
      } else {
        await updateCrew(detail.id, {
          name: detail.name.trim(),
          phone: detail.phone || null,
          emergency_contact_name: detail.emergency_contact_name || null,
          emergency_contact_phone: detail.emergency_contact_phone || null,
          notes: detail.notes || null,
        })
        await load()
      }
      setDetail(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function approve() {
    if (!detail) return
    setBusy(true)
    try {
      if (preview) setCrew(current => (current ?? []).map(person => person.id === detail.id ? { ...person, is_approved: true } : person))
      else { await approveCrew(detail.id); await load() }
      setDetail(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) return
    setBusy(true)
    try {
      if (preview) {
        const person: Crew = {
          id: `preview-crew-${form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          tenant_id: previewCrew[0].tenant_id,
          airtable_id: null,
          name: form.name.trim(),
          given_name: null,
          family_name: null,
          phone: form.phone || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
          notes: null,
          is_approved: true,
          created_at: '2026-11-25T00:00:00Z',
        }
        setCrew(current => [...(current ?? []), person])
      } else {
        await addCrew({
          name: form.name.trim(),
          phone: form.phone || undefined,
          emergency_contact_name: form.emergency_contact_name || undefined,
          emergency_contact_phone: form.emergency_contact_phone || undefined,
        })
      }
      setAdding(false); setForm({ name: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '' })
      if (!preview) load()
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  const histVisible = useMemo(() => {
    if (!history) return []
    return history
      .filter(h => histFilter === 'all' || h.status === histFilter)
      .sort((a, b) => (b.races?.race_date ?? '').localeCompare(a.races?.race_date ?? ''))
  }, [history, histFilter])

  if (err && !crew) return <main className="cl-container cl-admin-main"><ClNotice tone="error" title="Could not load crew" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice></main>

  if (detail) {
    const c = counts.get(detail.id) ?? { a: 0, s: 0 }
    return (
      <main className="cl-container cl-admin-main">
        <div className="cl-admin-back"><ClButton variant="text" onClick={() => setDetail(null)}>← All crew</ClButton></div>
        <ClPageHeader eyebrow="Crew profile" title={detail.name} description={detail.is_approved ? 'Approved for the public crew list.' : 'Pending review — not yet approved for the public crew list.'} />

        <section className="cl-panel cl-admin-form">
          <div className="cl-admin-section-heading"><div><p className="cl-eyebrow">Contact details</p><h2>Crew information</h2></div><ClStatus tone={detail.is_approved ? 'open' : 'warning'}>{detail.is_approved ? 'Approved' : 'Pending review'}</ClStatus></div>
          <div className="cl-admin-form-grid">
            <ClInput id="crew-detail-name" label="Name" value={detail.name} onChange={e => setDetail({ ...detail, name: e.target.value })} />
            <ClInput id="crew-detail-phone" label="Phone" optional value={detail.phone ?? ''} onChange={e => setDetail({ ...detail, phone: e.target.value })} />
            <ClInput id="crew-detail-emergency" label="Emergency contact" optional value={detail.emergency_contact_name ?? ''} onChange={e => setDetail({ ...detail, emergency_contact_name: e.target.value })} />
            <ClInput id="crew-detail-emergency-phone" label="Emergency phone" optional value={detail.emergency_contact_phone ?? ''} onChange={e => setDetail({ ...detail, emergency_contact_phone: e.target.value })} />
          </div>
          <div className="cl-admin-form-actions cl-admin-form-actions--wrap">
            <ClButton loading={busy} onClick={saveDetail}>Save details</ClButton>
            {!detail.is_approved && <ClButton variant="secondary" disabled={busy} onClick={approve}>Approve to public crew list</ClButton>}
            {!detail.is_approved && <ClButton variant="danger" disabled={busy} onClick={() => setConfirming('decline')}>Decline</ClButton>}
            <ClButton variant="danger" disabled={busy} onClick={() => setConfirming('delete')}>Delete crew</ClButton>
          </div>

          {confirming && (
            <div className="cl-admin-confirm" role="alertdialog" aria-label="Confirm deletion">
              <div>
                <strong>{confirming === 'decline' ? `Decline ${detail.name}'s registration?` : `Delete ${detail.name}?`}</strong>
                <p>{c.a + c.s > 0
                  ? `This permanently removes them and their ${c.a + c.s} signup${c.a + c.s > 1 ? 's' : ''}. This cannot be undone.`
                  : 'This permanently removes them. This cannot be undone.'}</p>
              </div>
              <div>
                <ClButton variant="danger" loading={busy} onClick={doDelete}>{confirming === 'decline' ? 'Yes, decline' : 'Yes, delete'}</ClButton>
                <ClButton variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</ClButton>
              </div>
            </div>
          )}
        </section>

        <section className="cl-admin-history">
          <div className="cl-admin-section-heading cl-admin-section-heading--compact"><div><p className="cl-eyebrow">Participation</p><h2>Race history</h2></div></div>
          <ClTabs idPrefix="crew-history" label="History filter" active={histFilter} onChange={id => setHistFilter(id as typeof histFilter)} items={[
            { id: 'all', label: `All ${c.a + c.s}` },
            { id: 'selected', label: `Selected ${c.s}` },
            { id: 'available', label: `Available ${c.a}` },
          ]} />
          {!history && <div className="cl-panel cl-admin-state"><ClSkeleton rows={2} label="Loading crew history" /></div>}
          {history && histVisible.length === 0 && <div className="cl-panel"><ClEmpty title="No races in this view" hint="Choose another history filter." /></div>}
          {history && histVisible.length > 0 && (
            <div className="cl-panel cl-admin-history-list" id="crew-history-panel">
              {histVisible.map(h => (
                <div key={h.id} className="cl-admin-history-row">
                  <span className="cl-mono">{h.races?.race_date}</span>
                  <strong>{h.races?.name}</strong>
                  <ClStatus tone={h.status === 'selected' ? 'selected' : 'neutral'}>{h.status}</ClStatus>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="cl-container cl-admin-main">
      <ClPageHeader
        eyebrow="Crew directory"
        title="Crew"
        description="Open a person for contact details, approval and their full race history."
        actions={<ClButton variant={adding ? 'secondary' : 'primary'} onClick={() => setAdding(v => !v)}>{adding ? 'Cancel' : 'Add crew'}</ClButton>}
      />

      {adding && (
        <form onSubmit={submitAdd} className="cl-panel cl-admin-form">
          <div className="cl-admin-section-heading"><div><p className="cl-eyebrow">Directory entry</p><h2>Add a crew member</h2></div><p>Admin-added crew are approved immediately.</p></div>
          <div className="cl-admin-form-grid">
            <ClInput id="add-crew-name" label="Full name" value={form.name} required onChange={e => setForm({ ...form, name: e.target.value })} />
            <ClInput id="add-crew-phone" label="Phone" optional value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <ClInput id="add-crew-emergency" label="Emergency contact" optional value={form.emergency_contact_name} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} />
            <ClInput id="add-crew-emergency-phone" label="Emergency phone" optional value={form.emergency_contact_phone} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} />
          </div>
          <div className="cl-admin-form-actions"><ClButton loading={busy} type="submit">Save crew member</ClButton></div>
        </form>
      )}

      <ClInput id="crew-search" label="Search crew" placeholder="Type a crew name…" value={query} onChange={e => setQuery(e.target.value)} />

      {err && <ClNotice tone="error" title="Could not load crew" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{err}</ClNotice>}
      {!err && (!crew || !signups) && <div className="cl-panel cl-admin-state"><ClSkeleton rows={5} label="Loading crew" /></div>}
      {crew && signups && filtered.length === 0 && <div className="cl-panel"><ClEmpty title="No crew found" hint={query ? 'Try a different search.' : 'Add the first crew member to this team.'} /></div>}

      {crew && signups && filtered.length > 0 && (
        <div className="cl-panel cl-admin-roster-list">
          {filtered.map(c => {
            const n = counts.get(c.id) ?? { a: 0, s: 0 }
            return (
              <button key={c.id} className="cl-admin-roster-row" onClick={() => openDetail(c)}>
                <span className="cl-admin-roster-row__identity"><strong>{c.name}</strong><small>{c.phone ?? 'No phone recorded'}</small></span>
                {!c.is_approved && <ClStatus tone="warning">Pending</ClStatus>}
                <span className="cl-admin-roster-row__counts"><ClStatus>{n.a} available</ClStatus><ClStatus tone="selected">{n.s} selected</ClStatus></span>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
