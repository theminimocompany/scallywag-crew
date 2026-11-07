import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { acceptInvite, errorText } from '@/lib/api'
import { navigate } from '@/lib/hash'
import { Spinner, ErrText } from '@/components/bits'

interface AcceptedTeam { id: string; name: string; slug: string }

// React StrictMode can mount an effect twice. Share the in-flight redemption so
// a single-use token is never submitted twice by the same page.
const redemptions = new Map<string, Promise<AcceptedTeam>>()

async function redeem(token: string): Promise<AcceptedTeam> {
  const tenantId = await acceptInvite(token)
  const { data, error } = await supabase
    .from('tenants').select('id,name,slug').eq('id', tenantId).single()
  if (error) throw error
  return data as AcceptedTeam
}

function redeemOnce(token: string): Promise<AcceptedTeam> {
  const existing = redemptions.get(token)
  if (existing) return existing
  const pending = redeem(token)
  redemptions.set(token, pending)
  return pending
}

export default function AcceptInvite({ token, email, onSignOut }: {
  token: string
  email: string
  onSignOut: () => Promise<void>
}) {
  const [stage, setStage] = useState<'accepting' | 'success' | 'error'>('accepting')
  const [team, setTeam] = useState<AcceptedTeam | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setStage('error')
      setErr('This invite link is incomplete. Ask the team admin for a fresh link.')
      return
    }
    setStage('accepting')
    setErr(null)
    redeemOnce(token)
      .then(accepted => {
        if (cancelled) return
        sessionStorage.removeItem('crewlist_auth_return')
        setTeam(accepted)
        setStage('success')
      })
      .catch(e => {
        // Permit an explicit retry after an expired/network/authorization error.
        redemptions.delete(token)
        if (cancelled) return
        setErr(errorText(e))
        setStage('error')
      })
    return () => { cancelled = true }
  }, [token, attempt])

  return (
    <div className="min-h-100dvh flex flex-col">
      <header className="hairline-b">
        <div className="page flex items-center justify-between" style={{ minHeight: 56 }}>
          <button className="wordmark cursor-pointer" style={{ textTransform: 'none' }} onClick={() => navigate('/login')}>Crewlist.</button>
          <button className="chip cursor-pointer" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="page flex-1 py-10 fade-in" aria-live="polite">
        <div className="panel p-6">
          {stage === 'accepting' && (
            <>
              <h1 className="font-semibold" style={{ fontSize: 22 }}>Accepting your invite</h1>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
                Signed in as {email}. Keep this page open while we add you to the team.
              </p>
              <Spinner label="Confirming co-admin access…" />
            </>
          )}

          {stage === 'success' && team && (
            <div className="space-y-4">
              <div>
                <div className="eyebrow">Invite accepted</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>You’re now an admin of {team.name}</h1>
                <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
                  You can manage races, crew, sign-ups and team settings. Sailors still won’t need accounts.
                </p>
              </div>
              <button className="btn-primary w-full" onClick={() => navigate(`/t/${team.slug}/admin`)}>
                Open team admin →
              </button>
              <button className="btn-ghost w-full" onClick={() => navigate(`/t/${team.slug}/schedule`)}>
                View public schedule
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div className="space-y-4">
              <div>
                <div className="eyebrow">Co-admin invite</div>
                <h1 className="font-semibold" style={{ fontSize: 24 }}>We couldn’t accept this invite</h1>
                <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>
                  You’re signed in as {email}. If the invite was sent to another address, sign out and use that email instead.
                </p>
              </div>
              {err && <ErrText>{err}</ErrText>}
              {token && (
                <button className="btn-primary w-full" onClick={() => setAttempt(n => n + 1)}>
                  Try again
                </button>
              )}
              <button className="btn-ghost w-full" onClick={onSignOut}>
                Use a different account
              </button>
              <button className="btn-ghost w-full" onClick={() => navigate('/login')}>
                Back to your teams
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
