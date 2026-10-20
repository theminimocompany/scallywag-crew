import { useEffect, useState } from 'react'
import {
  getTenant, fetchRaces, updateTeamName, setRaceHidden, setRaceSignupClosed,
  listAdmins, addAdminByEmail, fmtDate,
  type Tenant, type Race, type AdminInfo,
} from '@/lib/api'
import { setTeamName } from '@/lib/tenant'
import { Spinner, ErrText } from '@/components/bits'

export default function AdminSettings() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [races, setRaces] = useState<Race[]>([])
  const [admins, setAdmins] = useState<AdminInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  // panel-local state
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState('')
  const [raceBusy, setRaceBusy] = useState<string | null>(null)
  const [raceMsg, setRaceMsg] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminMsg, setAdminMsg] = useState('')
  const [adminErr, setAdminErr] = useState('')

  async function load() {
    setLoading(true); setLoadErr('')
    try {
      const [t, r, a] = await Promise.all([getTenant(), fetchRaces(), listAdmins()])
      setTenant(t)
      setNameDraft(t.name)
      setRaces(r)
      setAdmins(a)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = races.filter(r => r.race_date >= today)

  async function saveName() {
    const next = nameDraft.trim()
    if (!next || next === tenant?.name) return
    setSavingName(true); setNameMsg('')
    try {
      await updateTeamName(next)
      setTeamName(next)
      setTenant(t => (t ? { ...t, name: next } : t))
      setNameMsg('Saved — the new name is live across the site.')
    } catch (e) {
      setNameMsg(`Could not save: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSavingName(false)
    }
  }

  async function toggleRace(r: Race) {
    const hidden = !(r.is_hidden ?? false)
    setRaceBusy(r.id); setRaceMsg('')
    try {
      await setRaceHidden(r.id, hidden)
      setRaces(rs => rs.map(x => (x.id === r.id ? { ...x, is_hidden: hidden } : x)))
    } catch (e) {
      setRaceMsg(`Could not update ${r.name}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRaceBusy(null)
    }
  }

  async function toggleRaceSignup(r: Race) {
    const closed = !(r.signup_closed ?? false)
    setRaceBusy(r.id); setRaceMsg('')
    try {
      await setRaceSignupClosed(r.id, closed)
      setRaces(rs => rs.map(x => (x.id === r.id ? { ...x, signup_closed: closed } : x)))
    } catch (e) {
      setRaceMsg(`Could not update ${r.name}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRaceBusy(null)
    }
  }

  async function addAdmin() {
    const email = emailDraft.trim()
    if (!email) return
    setAddingAdmin(true); setAdminMsg(''); setAdminErr('')
    try {
      await addAdminByEmail(email)
      setEmailDraft('')
      setAdminMsg(`${email} can now sign in to the admin console.`)
      const a = await listAdmins()
      setAdmins(a)
    } catch (e) {
      setAdminErr(e instanceof Error ? e.message : String(e))
    } finally {
      setAddingAdmin(false)
    }
  }

  if (loading) return <div className="page py-10 grid place-content-center"><Spinner label="Loading settings…" /></div>
  if (loadErr) return <div className="page py-10"><ErrText>{loadErr}</ErrText></div>

  return (
    <main className="page py-6 space-y-4 fade-in">
      <div>
        <div className="eyebrow">Admin</div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* ---------- team name ---------- */}
      <section className="panel p-4 space-y-3">
        <div>
          <div className="eyebrow">Branding</div>
          <h2 className="font-semibold">Team name</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Shown in the header of every page, public and admin.
          </p>
        </div>
        <input
          className="input w-full"
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          maxLength={60}
          aria-label="Team name"
        />
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            disabled={savingName || !nameDraft.trim() || nameDraft.trim() === tenant?.name}
            onClick={saveName}
          >
            {savingName ? 'Saving…' : 'Save name'}
          </button>
          {nameMsg && <span className="text-sm" style={{ color: 'hsl(var(--slate))' }}>{nameMsg}</span>}
        </div>
      </section>

      {/* ---------- race visibility ---------- */}
      <section className="panel p-4 space-y-3">
        <div>
          <div className="eyebrow">Public schedule</div>
          <h2 className="font-semibold">Race visibility & sign-ups</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Hidden races vanish from the public schedule entirely. Closed races
            stay listed but stop taking new sign-ups — handy once a boat is
            full. You can still move people in admin either way.
          </p>
        </div>
        {raceMsg && <ErrText>{raceMsg}</ErrText>}
        <ul className="divide-y" style={{ borderColor: 'hsl(var(--frost))' }}>
          {upcoming.map(r => {
            const hidden = r.is_hidden ?? false
            const closed = r.signup_closed ?? false
            const d = fmtDate(r.race_date)
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                    {d.dow} {d.day} · {d.mon}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-none">
                  <button
                    className={`chip cursor-pointer ${hidden ? '' : 'chip-on'}`}
                    disabled={raceBusy === r.id}
                    onClick={() => toggleRace(r)}
                    aria-pressed={!hidden}
                  >
                    <span className="dot" aria-hidden />
                    {raceBusy === r.id ? 'Saving…' : hidden ? 'Hidden' : 'Visible'}
                  </button>
                  <button
                    className={`chip cursor-pointer ${closed ? '' : 'chip-on'}`}
                    disabled={raceBusy === r.id || hidden}
                    onClick={() => toggleRaceSignup(r)}
                    aria-pressed={!closed}
                    title={hidden ? 'Hidden races take no sign-ups anyway' : undefined}
                  >
                    <span className="dot" aria-hidden />
                    {raceBusy === r.id ? 'Saving…' : closed ? 'Sign-ups closed' : 'Sign-ups open'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---------- admins ---------- */}
      <section className="panel p-4 space-y-3">
        <div>
          <div className="eyebrow">Access</div>
          <h2 className="font-semibold">Admins</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Everyone listed here can sign in to this console.
          </p>
        </div>
        <ul className="space-y-1.5">
          {admins.map(a => (
            <li key={a.email} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{a.email}</span>
              {a.is_you && <span className="chip chip-on">You</span>}
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <input
            className="input w-full"
            type="email"
            placeholder="new-admin@example.com"
            value={emailDraft}
            onChange={e => setEmailDraft(e.target.value)}
            aria-label="New admin email"
          />
          <button className="btn-primary" disabled={addingAdmin || !emailDraft.trim()} onClick={addAdmin}>
            {addingAdmin ? 'Adding…' : 'Add admin'}
          </button>
          {adminMsg && <p className="text-sm" style={{ color: 'hsl(var(--royal))' }}>{adminMsg}</p>}
          {adminErr && <ErrText>{adminErr}</ErrText>}
          <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
            No password needed: the new admin opens the login page, taps
            “No password handy? Use an email link instead”, and enters their
            email — that creates their login and signs them in (they'll see an
            empty console at first). Then add the same email here and have
            them refresh. Removing an admin is a one-line change in the Table
            Editor (tenant_members) — ask me if you ever need it.
          </p>
        </div>
      </section>
    </main>
  )
}
