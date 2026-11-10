import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

// Implicit recovery callbacks append #access_token=… to the redirect URL.
// Older reset emails placed that fragment after our hash route, producing
// #/reset-password#access_token=…, which neither the router nor Supabase can
// parse. Normalize those links before creating the auth client.
const malformedRecoveryPrefix = '#/reset-password#'
if (window.location.hash.startsWith(malformedRecoveryPrefix)) {
  const url = new URL(window.location.href)
  url.hash = window.location.hash.slice(malformedRecoveryPrefix.length)
  url.searchParams.set('recovery', '1')
  window.history.replaceState(null, '', url)
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
