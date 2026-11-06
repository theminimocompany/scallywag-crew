import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { Spinner, ErrorBox } from '@/components/bits'

interface Membership { tenant_id: string; tenants: { name: string; slug: string; status: string } | null }

/** Post-login home: every team you admin, plus the console entry if you have it. */
export default function AccountHome({ email }: { email: string }) {
  const [rows, setRows] = useState<Membership[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setErr(null)
    const { data, error } = await supabase
      .from('tenant_members').select('tenant_id, tenants(name,slug,status)')
    if (error) setErr(error.message)
    else setRows(data as unknown as Membership[])
  }
  useEffect(() => { load() }, [])

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <span className="wordmark" style={{ textTransform: 'none' }}>Crewlist.</span>
          <button className="chip cursor-pointer" onClick={async () => { await supabase.auth.signOut(); navigate('/join') }}>Sign out</button>
        </div>
      </header>
      <main className="page flex-1 py-8 fade-in">
        <h1 className="font-semibold" style={{ fontSize: 24 }}>Your teams</h1>
        <p className="text-sm mt-1 mb-6" style={{ color: 'hsl(var(--slate))' }}>Signed in as {email}.</p>
        {!rows && !err && <Spinner />}
        {err && <ErrorBox message={err} onRetry={load} />}
        {rows && (
          <div className="space-y-3">
            {rows.map(m => m.tenants && (
              <button key={m.tenant_id} className="panel p-4 w-full text-left cursor-pointer" onClick={() => navigate(`/t/${m.tenants!.slug}/admin`)}>
                <div className="font-semibold">{m.tenants.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--slate))' }}>
                  /t/{m.tenants.slug}{m.tenants.status === 'suspended' ? ' · suspended' : ''}
                </div>
              </button>
            ))}
            {rows.length === 0 && (
              <p className="text-sm" style={{ color: 'hsl(var(--slate))' }}>
                You're not an admin of any team yet. Start your own, or ask a team admin to invite you.
              </p>
            )}
            <button className="btn-primary w-full" onClick={() => navigate('/join')}>Start a new team →</button>
          </div>
        )}
      </main>
    </div>
  )
}
