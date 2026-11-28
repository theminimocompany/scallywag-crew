import { useLocation } from 'react-router'

const legacyPagesHost = 'theminimocompany.github.io'
const legacyPagesBase = '/scallywag-crew/'

// Retain the existing export name so this routing migration does not ripple
// through unrelated components. React Router owns location subscriptions.
export function useHash(): string {
  return useLocation().pathname
}

export function currentRoute(): string {
  return window.location.pathname || '/'
}

export function navigate(to: string) {
  const route = to.startsWith('#') ? to.slice(1) : to
  const pathname = route.startsWith('/') ? route : `/${route}`
  window.history.pushState(null, '', pathname)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// Convert old application routes, but never implicit Auth fragments such as
// #access_token=...; supabase.ts handles those before calling this function.
export function normalizeLegacyUrl() {
  if (!window.location.hash.startsWith('#/')) return
  const legacyRoute = window.location.hash.slice(1)
  const legacyUrl = new URL(legacyRoute, window.location.origin)
  const url = new URL(window.location.href)
  const base = window.location.hostname === legacyPagesHost ? legacyPagesBase : '/'
  url.pathname = `${base}${legacyUrl.pathname.replace(/^\/+/, '')}`
  legacyUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  url.hash = ''
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

export function appUrl(route = ''): string {
  const base = window.location.hostname === legacyPagesHost ? legacyPagesBase : '/'
  return `${window.location.origin}${base}${route.replace(/^\/+/, '')}`
}

// Accept both current pathnames and legacy stored '#/...' destinations.
export function segments(route: string): string[] {
  return route.replace(/^#/, '').split('?')[0].split('/').filter(Boolean)
}
