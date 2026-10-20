import { useEffect, useState } from 'react'

// Tiny hash router — immune to GitHub Pages 404s and static-preview sub-route
// issues, since everything lives under /#/...
export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`
}

// Parse '#/t/scallywag/admin/races/abc' → ['t','scallywag','admin','races','abc']
export function segments(hash: string): string[] {
  return hash.replace(/^#/, '').split('/').filter(Boolean)
}
