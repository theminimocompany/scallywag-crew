import { useEffect, useState } from 'react'
import {
  getTenant, fetchRaces, updateTeamName, setRaceHidden, setRaceSignupClosed,
  listAdmins, listInvites, createInvite, revokeInvite, removeAdmin, fmtDate, errorText,
  type Tenant, type Race, type AdminInfo, type InviteInfo,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { setTeamName } from '@/lib/tenant'
import { navigate } from '@/lib/hash'
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
  const [invites, setInvites] = useState<InviteInfo[]>([])
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeStage, setRemoveStage] = useState<1 | 2>(1)
  const [removeBusy, setRemoveBusy] = useState(false)

  async function load() {
    setLoading(true); setLoadErr('')
    try {
      const [t, r, a, inv] = await Promise.all([getTenant(), fetchRaces(), listAdmins(), listInvites()])
      setTenant(t)
      setNameDraft(t.name)
      setRaces(r)
      setAdmins(a)
      setInvites(inv)
    } catch (e) {
      setLoadErr(errorText(e))
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
      setNameMsg(`Could not save: ${errorText(e)}`)
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
      setRaceMsg(`Could not update ${r.name}: ${errorText(e)}`)
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
      setRaceMsg(`Could not update ${r.name}: ${errorText(e)}`)
    } finally {
      setRaceBusy(null)
    }
  }

  function linkFor(token: string): string {
    return `${window.location.origin}${window.location.pathname}#/invite/${token}`
  }

  async function invite(email: string) {
    setAddingAdmin(true); setAdminMsg(''); setAdminErr(''); setInviteLink(''); setCopied(false)
    try {
      const token = await createInvite(email)
      setEmailDraft('')
      setInviteLink(linkFor(token))
      setAdminMsg(`Invite created for ${email} — send them the link below.`)
      setInvites(await listInvites())
    } catch (e) {
      setAdminErr(errorText(e))
    } finally {
      setAddingAdmin(false)
    }
  }

  async function revoke(id: string) {
    setAdminErr('')
    try {
      await revokeInvite(id)
      setInvites(await listInvites())
    } catch (e) {
      setAdminErr(errorText(e))
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoveBusy(true); setAdminErr('')
    const email = removeTarget
    try {
      await removeAdmin(email)
      const a = await listAdmins()
      setAdmins(a)
      setRemoveTarget(null)
      if (!a.some(x => x.is_you)) {
        // you just removed yourself — back to your account home
        await supabase.auth.signOut()
        navigate('/login')
      }
    } catch (e) {
      setAdminErr(errorText(e))
      setRemoveTarget(null)
    } finally {
      setRemoveBusy(false)
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
          <h2 className="font-semibold">Admins · max 4</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
            Everyone listed here can sign in to this console. Pending invites count towards the 4.
          </p>
        </div>
        <ul className="space-y-1.5">
          {admins.map(a => (
            <li key={a.email} className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium break-all">{a.email}</span>
                {a.is_you && <span className="chip chip-on">You</span>}
                <button
                  className="text-xs font-medium cursor-pointer ml-auto"
                  style={{ color: 'hsl(var(--destructive))', minHeight: 36 }}
                  onClick={() => { setRemoveTarget(a.email); setRemoveStage(1); setAdminErr('') }}
                >
                  Remove
                </button>
              </div>
              {removeTarget === a.email && (
                <div className="panel p-3 mt-1.5 space-y-2" style={{ borderColor: 'hsl(var(--destructive))' }}>
                  <p className="text-sm">
                    {removeStage === 1
                      ? `Remove ${a.email} as admin? They lose access to this console immediately.`
                      : `Are you sure? This can't be undone — ${a.email} would need a fresh invite to get back in.`}
                  </p>
                  <div className="flex gap-2">
                    {removeStage === 1 ? (
                      <button className="btn-ghost" onClick={() => setRemoveStage(2)}>Yes, continue</button>
                    ) : (
                      <button className="btn-primary" style={{ background: 'hsl(var(--destructive))' }} disabled={removeBusy} onClick={confirmRemove}>
                        {removeBusy ? 'Removing…' : 'Confirm removal'}
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => setRemoveTarget(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {invites.filter(i => i.status === 'pending').length > 0 && (
          <div>
            <div className="eyebrow">Pending invites</div>
            <ul className="space-y-1.5">
              {invites.filter(i => i.status === 'pending').map(i => (
                <li key={i.id} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="break-all">{i.email}</span>
                  <span className="text-xs" style={{ color: 'hsl(var(--slate))' }}>expires {i.expires_at.slice(0, 10)}</span>
                  <span className="ml-auto flex gap-3">
                    <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--royal))', minHeight: 36 }} disabled={addingAdmin} onClick={() => invite(i.email)}>
                      Resend
                    </button>
                    <button className="text-xs font-medium cursor-pointer" style={{ color: 'hsl(var(--destructive))', minHeight: 36 }} onClick={() => revoke(i.id)}>
                      Revoke
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <input
            className="input w-full"
            type="email"
            placeholder="co-admin@example.com"
            value={emailDraft}
            onChange={e => setEmailDraft(e.target.value)}
            aria-label="Co-admin email"
          />
          <button className="btn-primary" disabled={addingAdmin || !emailDraft.trim()} onClick={() => invite(emailDraft.trim())}>
            {addingAdmin ? 'Creating…' : 'Create invite link'}
          </button>
          {adminMsg && <p className="text-sm" style={{ color: 'hsl(var(--royal))' }}>{adminMsg}</p>}
          {adminErr && <ErrText>{adminErr}</ErrText>}
          {inviteLink && (
            <div className="panel p-3 space-y-2">
              <p className="text-sm break-all font-medium">{inviteLink}</p>
              <button className="btn-ghost w-full" onClick={async () => {
                try { await navigator.clipboard.writeText(inviteLink); setCopied(true) } catch { window.prompt('Copy the invite link:', inviteLink) }
              }}>
                {copied ? 'Copied ✓' : 'Copy invite link'}
              </button>
              <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                Send it by WhatsApp — it expires in 7 days and only works for the invited email.
                Branded email invitations arrive once Brevo is connected.
              </p>
            </div>
          )}
          <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
            The co-admin opens the link, signs in (password or email link), and lands in this console.
            Removing the last admin is blocked — every team keeps at least one.
          </p>
        </div>
      </section>
    </main>
  )
}
