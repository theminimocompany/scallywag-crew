import { fmtDate } from '@/lib/api'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16" role="status">
      <span
        className="inline-block rounded-full border-2 border-[hsl(var(--frost))] border-t-[hsl(var(--royal))] animate-spin"
        style={{ width: 20, height: 20 }}
        aria-hidden
      />
      <span className="text-sm" style={{ color: 'hsl(var(--slate))' }}>{label}</span>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel p-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm mt-1" style={{ color: 'hsl(var(--slate))' }}>{hint}</p>}
    </div>
  )
}

export function ErrText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm break-words" role="alert" style={{ color: 'hsl(var(--destructive))' }}>
      {children}
    </p>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel p-6 text-center" role="alert">
      <p className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>Something went wrong</p>
      <p className="text-sm mt-1 break-words" style={{ color: 'hsl(var(--slate))' }}>{message}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Date block: big day number + weekday, mono — used at the left of race rows */
export function DateBlock({ iso }: { iso: string }) {
  const { day, dow } = fmtDate(iso)
  return (
    <div className="mono flex flex-col items-center flex-none" style={{ width: 44 }}>
      <span className="font-medium" style={{ fontSize: 20, lineHeight: 1.1 }}>{day}</span>
      <span className="uppercase" style={{ fontSize: 10.5, color: 'hsl(var(--slate))', letterSpacing: '0.06em' }}>{dow}</span>
    </div>
  )
}
