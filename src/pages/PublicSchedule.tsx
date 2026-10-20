import { useEffect, useState } from 'react'
import { fetchSchedule, groupByMonth, type ScheduleRow } from '@/lib/api'
import { PublicHeader, PublicTabs } from '@/components/chrome'
import { Spinner, Empty, ErrorBox, DateBlock } from '@/components/bits'

export default function PublicSchedule() {
  const [rows, setRows] = useState<ScheduleRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setErr(null)
    fetchSchedule()
      .then(d => setRows(d.filter(r => r.selected_crew.length > 0 || true)))
      .catch(e => setErr(e.message))
  }
  useEffect(load, [])

  return (
    <div className="min-h-100dvh flex flex-col">
      <PublicHeader />
      <main className="page flex-1 py-5 space-y-5 fade-in">
        <PublicTabs active="schedule" />
        <div>
          <h1 className="font-semibold" style={{ fontSize: 22 }}>Upcoming races</h1>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
            Selected crew is published here once confirmed. Past races and availability lists are private.
          </p>
        </div>

        {err && <ErrorBox message={err} onRetry={load} />}
        {!err && !rows && <Spinner />}
        {rows && rows.length === 0 && (
          <Empty title="No upcoming races" hint="New races appear here once the team posts them." />
        )}

        {rows && groupByMonth(rows).map(([month, races]) => (
          <section key={month}>
            <h2 className="month-sep">{month}</h2>
            <div className="divide-y divide-[hsl(var(--frost))]">
              {races.map(r => (
                <article key={r.race_id} className="flex gap-3 py-3.5">
                  <DateBlock iso={r.race_date} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium leading-snug">{r.race_name}</h3>
                    {r.selected_crew.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.selected_crew.map(n => (
                          <span key={n} className="chip chip-on" style={{ minHeight: 28, fontSize: 12.5 }}>
                            <span className="dot" aria-hidden />{n}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
                        Crew not selected yet — sign up to be considered.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
