import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

const malformedRecoveryPrefix = '#/reset-password#'

if (window.location.hash.startsWith(malformedRecoveryPrefix)) {
  const url = new URL(window.location.href)
  url.hash = window.location.hash.slice(malformedRecoveryPrefix.length)
  url.searchParams.set('recovery', '1')
  window.history.replaceState(null, '', url)
}

// Signup confirmation emails can also use implicit #access_token=… callbacks.
// Mark those URLs before Supabase consumes the fragment so the router can still
// recognize the email callback and restore its saved destination afterwards.
if (window.location.hash.startsWith('#access_token=')) {
  const url = new URL(window.location.href)
  url.searchParams.set('auth_callback', '1')
  window.history.replaceState(null, '', url)
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
