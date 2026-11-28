import { useEffect, useState } from 'react'
import {
  getTenant, fetchRaces, updateTeamName, setRaceHidden, setRaceSignupClosed,
  listAdmins, listInvites, createInvite, revokeInvite, removeAdmin, fmtDate, errorText,
  type Tenant, type Race, type AdminInfo, type InviteInfo,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { setTeamName } from '@/lib/tenant'
import { appUrl, navigate } from '@/lib/hash'
import { RaceMeta } from '@/components/bits'
import { ClButton, ClInput, ClNotice, ClPageHeader, ClSkeleton, ClStatus } from '@/components/CrewlistUI'
import { PREVIEW_INVITE_TOKEN, previewAdmins, previewInvites, previewRaces, previewTenant } from '@/pages/adminPreviewData'

export type AdminSettingsPreview = 'default' | 'loading' | 'error' | 'invite' | 'remove'

export default function AdminSettings({ preview }: { preview?: AdminSettingsPreview }) {
  const populatedPreview = !!preview && preview !== 'loading' && preview !== 'error'
  const [tenant, setTenant] = useState<Tenant | null>(populatedPreview ? { ...previewTenant } : null)
  const [races, setRaces] = useState<Race[]>(populatedPreview ? previewRaces.map(race => ({ ...race })) : [])
  const [admins, setAdmins] = useState<AdminInfo[]>(populatedPreview ? previewAdmins.map(admin => ({ ...admin })) : [])
  const [loading, setLoading] = useState(preview === 'loading' || !preview)
  const [loadErr, setLoadErr] = useState(preview === 'error' ? 'Synthetic settings load failure.' : '')

  const [nameDraft, setNameDraft] = useState(populatedPreview ? previewTenant.name : '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState('')
  const [raceBusy, setRaceBusy] = useState<string | null>(null)
  const [raceMsg, setRaceMsg] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminMsg, setAdminMsg] = useState(preview === 'invite' ? 'Invite created for new.admin@testing101.invalid — send them the link below.' : '')
  const [adminErr, setAdminErr] = useState('')
  const [invites, setInvites] = useState<InviteInfo[]>(populatedPreview ? previewInvites.map(invite => ({ ...invite })) : [])
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(preview === 'remove' ? previewAdmins[1].email : null)
  const [removeStage, setRemoveStage] = useState<1 | 2>(1)
  const [removeBusy, setRemoveBusy] = useState(false)

  async function load() {
    if (preview) {
      setTenant({ ...previewTenant })
      setNameDraft(previewTenant.name)
      setRaces(previewRaces.map(race => ({ ...race })))
      setAdmins(previewAdmins.map(admin => ({ ...admin })))
      setInvites(previewInvites.map(invite => ({ ...invite })))
      setLoadErr('')
      setLoading(false)
      return
    }
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
  useEffect(() => {
    if (!preview) load()
    else if (preview === 'invite') setInviteLink(appUrl(`/invite/${PREVIEW_INVITE_TOKEN}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = races.filter(r => r.race_date >= today)

  async function saveName() {
    const next = nameDraft.trim()
    if (!next || next === tenant?.name) return
    setSavingName(true); setNameMsg('')
    try {
      if (!preview) await updateTeamName(next)
      setTeamName(next)
      setTenant(t => (t ? { ...t, name: next } : t))
      setNameMsg(preview ? 'Synthetic preview saved locally — no team name was changed.' : 'Saved — the new name is live across the site.')
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
      if (!preview) await setRaceHidden(r.id, hidden)
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
      if (!preview) await setRaceSignupClosed(r.id, closed)
      setRaces(rs => rs.map(x => (x.id === r.id ? { ...x, signup_closed: closed } : x)))
    } catch (e) {
      setRaceMsg(`Could not update ${r.name}: ${errorText(e)}`)
    } finally {
      setRaceBusy(null)
    }
  }

  function linkFor(token: string): string {
    return appUrl(`/invite/${token}`)
  }

  async function invite(email: string) {
    setAddingAdmin(true); setAdminMsg(''); setAdminErr(''); setInviteLink(''); setCopied(false)
    try {
      const token = preview ? PREVIEW_INVITE_TOKEN : await createInvite(email)
      setEmailDraft('')
      setInviteLink(linkFor(token))
      setAdminMsg(preview ? `Synthetic invite created for ${email} — no invitation was sent or stored.` : `Invite created for ${email} — send them the link below.`)
      if (preview) {
        setInvites(current => [{ id: `preview-invite-${email}`, email, status: 'pending', expires_at: '2026-12-02T00:00:00Z', created_at: '2026-11-25T00:00:00Z' }, ...current.filter(item => item.email !== email)])
      } else setInvites(await listInvites())
    } catch (e) {
      setAdminErr(errorText(e))
    } finally {
      setAddingAdmin(false)
    }
  }

  async function revoke(id: string) {
    setAdminErr('')
    try {
      if (preview) setInvites(current => current.map(item => item.id === id ? { ...item, status: 'revoked' } : item))
      else {
        await revokeInvite(id)
        setInvites(await listInvites())
      }
    } catch (e) {
      setAdminErr(errorText(e))
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoveBusy(true); setAdminErr('')
    const email = removeTarget
    try {
      if (preview) {
        setAdmins(current => current.filter(admin => admin.email !== email))
        setRemoveTarget(null)
        setAdminMsg(`Synthetic removal of ${email} completed locally — no access was changed.`)
      } else {
        await removeAdmin(email)
        const a = await listAdmins()
        setAdmins(a)
        setRemoveTarget(null)
        if (!a.some(x => x.is_you)) {
          await supabase.auth.signOut()
          navigate('/login')
        }
      }
    } catch (e) {
      setAdminErr(errorText(e))
      setRemoveTarget(null)
    } finally {
      setRemoveBusy(false)
    }
  }

  if (loading) return <main className="cl-container cl-admin-main"><div className="cl-panel cl-admin-state"><ClSkeleton rows={5} label="Loading settings" /></div></main>
  if (loadErr) return <main className="cl-container cl-admin-main"><ClNotice tone="error" title="Could not load settings" action={<ClButton variant="secondary" size="small" onClick={load}>Try again</ClButton>}>{loadErr}</ClNotice></main>

  return (
    <main className="cl-container cl-admin-main">
      <ClPageHeader eyebrow="Team administration" title="Settings" description="Manage public branding, race availability and the people who can access this console." />

      <section className="cl-panel cl-admin-form">
        <div className="cl-admin-section-heading"><div><p className="cl-eyebrow">Branding</p><h2>Team name</h2></div><p>Shown in the header of every public and admin page.</p></div>
        <ClInput id="settings-team-name" label="Team name" value={nameDraft} maxLength={60} onChange={e => setNameDraft(e.target.value)} />
        <div className="cl-admin-form-actions cl-admin-form-actions--wrap">
          <ClButton loading={savingName} disabled={!nameDraft.trim() || nameDraft.trim() === tenant?.name} onClick={saveName}>Save name</ClButton>
        </div>
        {nameMsg && <ClNotice tone={nameMsg.startsWith('Could not') ? 'error' : 'success'} title={nameMsg.startsWith('Could not') ? 'Name not saved' : 'Team name updated'}>{nameMsg}</ClNotice>}
      </section>

      <section className="cl-panel cl-admin-form">
        <div className="cl-admin-section-heading"><div><p className="cl-eyebrow">Public schedule</p><h2>Race visibility & sign-ups</h2></div><p>Hidden races vanish publicly. Closed races stay listed but take no new sign-ups; admin crew selection still works.</p></div>
        {raceMsg && <ClNotice tone="error" title="Race setting not saved">{raceMsg}</ClNotice>}
        {upcoming.length === 0 && <p className="cl-admin-help">No upcoming races to configure.</p>}
        <div className="cl-admin-settings-races">
          {upcoming.map(r => {
            const hidden = r.is_hidden ?? false
            const closed = r.signup_closed ?? false
            const d = fmtDate(r.race_date)
            return (
              <div key={r.id} className="cl-admin-settings-race">
                <div>
                  <strong>{r.name}</strong>
                  <span className="cl-mono">{d.dow} {d.day} · {d.mon}</span>
                  <RaceMeta startTime={r.start_time} location={r.location} />
                </div>
                <div className="cl-admin-settings-race__controls">
                  <ClButton size="small" variant={hidden ? 'secondary' : 'primary'} disabled={raceBusy === r.id} onClick={() => toggleRace(r)} aria-pressed={!hidden}>
                    {raceBusy === r.id ? 'Saving…' : hidden ? 'Hidden' : 'Visible'}
                  </ClButton>
                  <ClButton size="small" variant={closed ? 'secondary' : 'primary'} disabled={raceBusy === r.id || hidden} onClick={() => toggleRaceSignup(r)} aria-pressed={!closed} title={hidden ? 'Hidden races take no sign-ups anyway' : undefined}>
                    {raceBusy === r.id ? 'Saving…' : closed ? 'Sign-ups closed' : 'Sign-ups open'}
                  </ClButton>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="cl-panel cl-admin-form">
        <div className="cl-admin-section-heading"><div><p className="cl-eyebrow">Access</p><h2>Admins · max 4</h2></div><p>Everyone listed can sign in to this console. Pending invitations count towards the four places.</p></div>
        <div className="cl-admin-access-list">
          {admins.map(a => (
            <div key={a.email} className="cl-admin-access-item">
              <div className="cl-admin-access-row">
                <span><strong>{a.email}</strong>{a.is_you && <ClStatus tone="selected">You</ClStatus>}</span>
                <ClButton variant="text" className="cl-admin-danger-text" onClick={() => { setRemoveTarget(a.email); setRemoveStage(1); setAdminErr('') }}>Remove</ClButton>
              </div>
              {removeTarget === a.email && (
                <div className="cl-admin-confirm" role="alertdialog" aria-label={`Remove ${a.email} as admin`}>
                  <div>
                    <strong>{removeStage === 1 ? `Remove ${a.email} as admin?` : 'Confirm admin removal'}</strong>
                    <p>{removeStage === 1
                      ? 'They lose access to this console immediately.'
                      : `This can't be undone — ${a.email} would need a fresh invite to get back in.`}</p>
                  </div>
                  <div>
                    {removeStage === 1
                      ? <ClButton variant="danger" onClick={() => setRemoveStage(2)}>Yes, continue</ClButton>
                      : <ClButton variant="danger" loading={removeBusy} onClick={confirmRemove}>Confirm removal</ClButton>}
                    <ClButton variant="secondary" disabled={removeBusy} onClick={() => setRemoveTarget(null)}>Cancel</ClButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {invites.filter(i => i.status === 'pending').length > 0 && (
          <div className="cl-admin-pending-invites">
            <p className="cl-eyebrow">Pending invites</p>
            {invites.filter(i => i.status === 'pending').map(i => (
              <div key={i.id} className="cl-admin-invite-row">
                <span><strong>{i.email}</strong><small>Expires {i.expires_at.slice(0, 10)}</small></span>
                <div><ClButton variant="text" disabled={addingAdmin} onClick={() => invite(i.email)}>Refresh link</ClButton><ClButton variant="text" className="cl-admin-danger-text" onClick={() => revoke(i.id)}>Revoke</ClButton></div>
              </div>
            ))}
          </div>
        )}

        <div className="cl-admin-invite-create">
          <ClInput id="settings-coadmin-email" label="Invite a co-admin" type="email" placeholder="co-admin@example.com" value={emailDraft} onChange={e => setEmailDraft(e.target.value)} />
          <ClButton loading={addingAdmin} disabled={!emailDraft.trim()} onClick={() => invite(emailDraft.trim())}>Create invite link</ClButton>
        </div>
        {adminMsg && <ClNotice tone="success" title="Admin access updated">{adminMsg}</ClNotice>}
        {adminErr && <ClNotice tone="error" title="Admin access not updated">{adminErr}</ClNotice>}
        {inviteLink && (
          <div className="cl-admin-invite-link">
            <p className="cl-mono">{inviteLink}</p>
            <ClButton variant="secondary" full onClick={async () => {
              if (preview) { setCopied(true); return }
              try { await navigator.clipboard.writeText(inviteLink); setCopied(true) } catch { window.prompt('Copy the invite link:', inviteLink) }
            }}>{copied ? 'Copied ✓' : 'Copy invite link'}</ClButton>
            <p>Send it by WhatsApp — it expires in 7 days and only works for the invited email. Crewlist does not email this invitation yet, so send the link yourself.</p>
          </div>
        )}
        <p className="cl-admin-help">The co-admin opens the link, creates a password or signs in, confirms their email if needed, and lands in this console. Removing the last admin is blocked — every team keeps at least one.</p>
      </section>
    </main>
  )
}
