import { useEffect, useMemo, useState } from 'react'
import {
  fetchDirectory, fetchSchedule, submitSignups, registerCrew, getTenant,
  groupByMonth, type DirectoryEntry, type ScheduleRow,
} from '@/lib/api'
import { PublicHeader, PublicTabs, FloatingBar } from '@/components/chrome'
import { Spinner, Empty, ErrorBox, DateBlock } from '@/components/bits'

export default function PublicSignup() {
  const [dir, setDir] = useState<DirectoryEntry[] | null>(null)
  const [races, setRaces] = useState<ScheduleRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // undefined = still unknown (pre-settings-migration tenants report undefined too);
  // only an explicit false closes the form.
  const [signupOpen, setSignupOpen] = useState<boolean | undefined>(undefined)

  const [crewId, setCrewId] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [newMode, setNewMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ name: string; count: number; pending: boolean } | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)

  const load = () => {
    setErr(null)
    Promise.all([fetchDirectory(), fetchSchedule(), getTenant()])
      .then(([d, s, t]) => { setDir(d); setRaces(s); setSignupOpen(t.signup_open ?? true) })
      .catch(e => setErr(e.message))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!dir) return []
    const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = strip(query.trim())
    return q ? dir.filter(d => strip(d.name).includes(q)) : dir
  }, [dir, query])

  // Picked races in chronological order (fetchSchedule returns date-sorted rows)
  const pickedRaces = useMemo(
    () => (races ?? []).filter(r => picked.has(r.race_id)),
    [races, picked],
  )

  const toggle = (id: string) => {
    setPicked(p => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const selectedName = newMode
    ? newName.trim()
    : dir?.find(d => d.crew_id === crewId)?.name ?? ''

  function validate(): boolean {
    if (!newMode && !crewId) { setFormErr('Search and pick your name first.'); return false }
    if (newMode && newName.trim().length < 2) { setFormErr('Enter your full name.'); return false }
    if (picked.size === 0) { setFormErr('Tick at least one race.'); return false }
    return true
  }

  function beginReview() {
    setFormErr(null)
    if (!validate()) return
    setConfirming(true)
    window.scrollTo({ top: 0 })
  }

  async function submit() {
    setFormErr(null)
    setBusy(true)
    try {
      let id = crewId
      let pending = false
      if (newMode) { id = await registerCrew(newName); pending = true }
      await submitSignups(id!, [...picked])
      setDone({ name: selectedName, count: picked.size, pending })
    } catch (e) {
      setFormErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-100dvh flex flex-col">
        <PublicHeader />
        <main className="page flex-1 py-10 fade-in">
          <div className="panel p-8 text-center space-y-3">
            <div
              className="mx-auto grid place-content-center rounded-full"
              style={{ width: 56, height: 56, background: 'hsl(var(--tint))' }}
              aria-hidden
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--royal))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h1 className="font-semibold" style={{ fontSize: 22 }}>You're on the list, {done.name}</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              {done.count} race{done.count > 1 ? 's' : ''} submitted.
              {done.pending
                ? ' As a new crew member, the team will review your details before you appear publicly.'
                : ' The team will confirm the selected crew closer to race day.'}
            </p>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              Need to withdraw? Message the team directly and they'll take you off the list.
            </p>
            <button className="btn-ghost w-full" onClick={() => { setDone(null); setConfirming(false); setPicked(new Set()); setCrewId(null); setNewMode(false); setNewName('') }}>
              Sign up for more races
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="min-h-100dvh flex flex-col">
        <PublicHeader />
        <main className="page flex-1 py-5 pb-32 space-y-5 fade-in">
          <div>
            <h1 className="font-semibold" style={{ fontSize: 22 }}>Confirm your sign-up</h1>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
              Check the details below, then confirm.
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="eyebrow">Your name</h2>
            <div className="panel p-4">
              <p className="font-medium">{selectedName}</p>
              {newMode && (
                <p className="text-xs mt-1" style={{ color: 'hsl(var(--slate))' }}>
                  New crew — the team will review your details before you appear publicly.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">Races · {pickedRaces.length}</h2>
            <div className="panel divide-y divide-[hsl(var(--frost))]">
              {pickedRaces.map(r => (
                <div key={r.race_id} className="flex items-center gap-3" style={{ padding: '10px 12px', minHeight: 44 }}>
                  <DateBlock iso={r.race_date} />
                  <span className="font-medium leading-snug flex-1 min-w-0">{r.race_name}</span>
                </div>
              ))}
            </div>
          </section>

          <FloatingBar>
            {formErr && (
              <p className="panel px-3 py-2 text-sm font-medium" role="alert" style={{ color: 'hsl(var(--destructive))' }}>
                {formErr}
              </p>
            )}
            <button
              className="btn-primary w-full"
              disabled={busy}
              onClick={submit}
              style={{ boxShadow: '0 10px 24px hsl(var(--royal) / 0.35)' }}
            >
              {busy ? 'Submitting…' : 'Confirm and submit'}
            </button>
            <button className="btn-ghost w-full" disabled={busy} onClick={() => { setConfirming(false); setFormErr(null) }}>
              Back to edit
            </button>
          </FloatingBar>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-100dvh flex flex-col">
      <PublicHeader />
      <main className="page flex-1 py-5 pb-32 space-y-5 fade-in">
        <PublicTabs active="signup" />
        <div>
          <h1 className="font-semibold" style={{ fontSize: 22 }}>Crew sign-up</h1>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
            Pick your name, tick the races you can do. The team confirms selection closer to the day.
          </p>
        </div>

        {err && <ErrorBox message={err} onRetry={load} />}
        {!err && (!dir || !races || signupOpen === undefined) && <Spinner />}

        {!err && signupOpen === false && dir && races && (
          <div className="panel p-8 text-center space-y-2">
            <p className="font-medium">Sign-ups are closed</p>
            <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
              The team isn't taking availability right now. Check the race
              schedule for confirmed crew lists, and check back here later.
            </p>
          </div>
        )}

        {!err && signupOpen === true && dir && races && (
          <>
            {/* Step 1 — who are you */}
            <section className="space-y-2">
              <h2 className="eyebrow">1 · Your name</h2>
              {!newMode ? (
                <>
                  {crewId ? (
                    <div className="panel p-4 flex items-center gap-3">
                      <span
                        className="grid place-content-center rounded-full shrink-0"
                        style={{ width: 32, height: 32, background: 'hsl(var(--tint))' }}
                        aria-hidden
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--royal))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      </span>
                      <span className="font-semibold flex-1 min-w-0" style={{ fontSize: 16 }}>{selectedName}</span>
                      <button
                        className="grid place-content-center rounded-full shrink-0"
                        style={{ width: 32, height: 32, color: 'hsl(var(--slate))', border: '1.5px solid hsl(var(--frost))' }}
                        onClick={() => { setCrewId(null); setQuery('') }}
                        aria-label="Change name"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="input"
                        placeholder="Search your name…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        aria-label="Search your name"
                      />
                      {query.trim() !== '' && filtered.length > 0 && (
                        <div className="panel divide-y divide-[hsl(var(--frost))] max-h-60 overflow-y-auto" role="group" aria-label="Crew names">
                          {filtered.map(d => (
                            <button
                              key={d.crew_id}
                              type="button"
                              className="checkrow w-full text-left"
                              onClick={() => { setCrewId(d.crew_id); setQuery('') }}
                            >
                              <span className="font-medium">{d.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <button className="btn-ghost w-full" onClick={() => { setNewMode(true); setCrewId(null) }}>
                    I'm new to the team
                  </button>
                </>
              ) : (
                <div className="panel p-4 space-y-3">
                  <input
                    className="input"
                    placeholder="Your full name"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    aria-label="Your full name"
                  />
                  <p className="text-xs" style={{ color: 'hsl(var(--slate))' }}>
                    New crew are reviewed by the team before appearing on the public list.
                  </p>
                  <button className="btn-ghost w-full" onClick={() => setNewMode(false)}>
                    Back to the crew list
                  </button>
                </div>
              )}
            </section>

            {/* Step 2 — races */}
            <section className="space-y-2">
              <h2 className="eyebrow">2 · Races you can do</h2>
              {races.length === 0 && <Empty title="No upcoming races" hint="Check back soon." />}
              {groupByMonth(races).map(([month, rs]) => (
                <div key={month}>
                  <h3 className="month-sep">{month}</h3>
                  <div className="divide-y divide-[hsl(var(--frost))]">
                    {rs.map(r => r.signup_closed ? (
                      <div key={r.race_id} className="checkrow" style={{ opacity: 0.55, cursor: 'default' }}>
                        <DateBlock iso={r.race_date} />
                        <span className="font-medium leading-snug flex-1 min-w-0">{r.race_name}</span>
                        <span className="chip" aria-label="Sign-ups closed for this race">Closed</span>
                      </div>
                    ) : (
                      <label key={r.race_id} className="checkrow">
                        <input
                          type="checkbox"
                          className="check"
                          checked={picked.has(r.race_id)}
                          onChange={() => toggle(r.race_id)}
                        />
                        <DateBlock iso={r.race_date} />
                        <span className="font-medium leading-snug flex-1 min-w-0">{r.race_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* Floating submit bar */}
            <FloatingBar>
              {formErr && (
                <p className="panel px-3 py-2 text-sm font-medium" role="alert" style={{ color: 'hsl(var(--destructive))' }}>
                  {formErr}
                </p>
              )}
              <button
                className="btn-primary w-full"
                onClick={beginReview}
                style={{ boxShadow: '0 10px 24px hsl(var(--royal) / 0.35)' }}
              >
                {picked.size > 0 ? `Review ${picked.size} race${picked.size > 1 ? 's' : ''}` : 'Review sign-up'}
              </button>
            </FloatingBar>
          </>
        )}
      </main>
    </div>
  )
}
