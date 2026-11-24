import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { navigate } from '@/lib/hash'
import { ClAuthShell, ClButton, ClInput, ClNotice } from '@/components/CrewlistUI'

type ResetPreview = 'checking' | 'invalid' | 'form' | 'validation' | 'mismatch' | 'loading' | 'error' | 'success' | 'warning'

export default function ResetPassword({
  session,
  authReady,
  preview,
}: {
  session: Session | null
  authReady: boolean
  preview?: ResetPreview
}) {
  const [password, setPassword] = useState(preview ? preview === 'validation' ? 'short' : 'synthetic-password' : '')
  const [confirmation, setConfirmation] = useState(preview ? preview === 'mismatch' ? 'different-password' : preview === 'validation' ? 'short' : 'synthetic-password' : '')
  const [busy, setBusy] = useState(preview === 'loading')
  const [err, setErr] = useState<string | null>(
    preview === 'validation' ? 'Use at least 8 characters for your new password.'
      : preview === 'mismatch' ? 'The two passwords do not match.'
        : preview === 'error' ? 'Your password could not be updated. Try again.' : null,
  )
  const [done, setDone] = useState(false)
  const [warning, setWarning] = useState<string | null>(preview === 'warning' ? 'Your password was changed, but other devices could not be signed out automatically.' : null)
  const [previewAction, setPreviewAction] = useState('Synthetic recovery state. No password, Auth session or recovery-storage change is made in this preview.')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) return setErr('Use at least 8 characters for your new password.')
    if (password !== confirmation) return setErr('The two passwords do not match.')

    if (preview) {
      setPreviewAction('The updated state was reached locally. No password was changed and no device was signed out.')
      setDone(true)
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setBusy(false)
      return setErr(error.message)
    }

    // The password has already changed. A failure here must not be presented
    // as a failed reset, and the current recovery session stays signed in.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
    setBusy(false)
    if (signOutError) setWarning('Your password was changed, but other devices could not be signed out automatically.')
    setDone(true)
  }

  function backToSignIn() {
    if (preview) {
      setPreviewAction('Sign-in navigation is disabled in this isolated preview. Your return destination was not changed.')
      return
    }
    navigate(sessionStorage.getItem('crewlist_auth_return') || '#/login')
  }

  function continueToDestination() {
    if (preview) {
      setPreviewAction('Continue is disabled in this isolated preview. No recovery keys were cleared and no live page was opened.')
      return
    }
    const back = sessionStorage.getItem('crewlist_auth_return') || '#/login'
    sessionStorage.removeItem('crewlist_auth_return')
    sessionStorage.removeItem('crewlist_recovery_email')
    sessionStorage.removeItem('crewlist_recovery_invite')
    navigate(back)
  }

  const checking = preview ? preview === 'checking' : !authReady
  const updated = preview ? done || preview === 'success' || preview === 'warning' : done
  const invalid = preview ? preview === 'invalid' : !session
  const showSignIn = preview ? preview === 'checking' || preview === 'invalid' : !session

  return (
    <ClAuthShell
      onBrand={() => {
        if (preview) setPreviewAction('Brand navigation is disabled in this isolated preview. No live page was opened.')
        else navigate('/join')
      }}
      preview={preview ? previewAction : undefined}
      action={showSignIn ? <ClButton variant="text" size="small" onClick={backToSignIn}>Sign in</ClButton> : undefined}
    >
      {checking ? (
        <div className="cl-auth-loading" role="status">
          <span className="cl-auth-spinner" aria-hidden="true" />
          <h1>Checking reset link</h1>
          <p>One moment while we validate this recovery link.</p>
        </div>
      ) : updated ? (
        <div className="cl-auth-stack">
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">PASSWORD UPDATED</p>
            <h1>Password updated</h1>
            <p>Your new password is active. Other devices have been signed out{warning ? ' where possible' : ''}.</p>
          </div>
          {warning && <ClNotice tone="warning" title="Other devices may still be signed in">{warning}</ClNotice>}
          <ClButton full onClick={continueToDestination}>Continue</ClButton>
        </div>
      ) : invalid ? (
        <div className="cl-auth-stack">
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">RECOVERY LINK</p>
            <h1>This reset link is no longer valid</h1>
            <p>It may have expired or already been used. Request a fresh link to continue.</p>
          </div>
          <ClButton full onClick={() => {
            if (preview) setPreviewAction('A fresh recovery link is requested from the separate forgot-password preview. No live page was opened.')
            else navigate('/forgot-password')
          }}>
            Request a new link
          </ClButton>
          <ClButton variant="secondary" full onClick={backToSignIn}>Back to sign in</ClButton>
        </div>
      ) : (
        <>
          <div className="cl-auth-heading">
            <p className="cl-eyebrow">NEW PASSWORD</p>
            <h1>Choose a new password</h1>
            <p>Use at least eight characters. This will sign out your other devices.</p>
          </div>
          <form onSubmit={submit} className="cl-auth-form">
            <ClInput
              id="new-password"
              label="New password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <ClInput
              id="confirm-password"
              label="Confirm new password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
            />
            {err && <ClNotice tone="error" title="Password not changed">{err}</ClNotice>}
            <ClButton full loading={busy} type="submit">
              {busy ? 'Updating…' : 'Update password'}
            </ClButton>
          </form>
        </>
      )}
    </ClAuthShell>
  )
}
