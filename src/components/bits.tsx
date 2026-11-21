import { fmtDate, fmtTime, normalizeTimeInput } from '@/lib/api'

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

/** Optional race start time and location, shared by admin and sailor views. */
export function RaceMeta({ startTime, location }: { startTime?: string | null; location?: string | null }) {
  const time = fmtTime(startTime)
  if (!time && !location?.trim()) return null
  return (
    <p className="text-sm mt-1 break-words" style={{ color: 'hsl(var(--slate))' }}>
      {time && <span className="mono">{time}</span>}
      {time && location?.trim() && <span aria-hidden> · </span>}
      {location?.trim()}
    </p>
  )
}

/** Locale-independent 24-hour time input; empty remains a valid optional value. */
export function TimeInput({
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Start time, optional, 24-hour HH:MM',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <input
      className="input mono"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder="13:45"
      maxLength={5}
      pattern="(?:[01]\d|2[0-3]):[0-5]\d"
      title="Use 24-hour time in HH:MM format, for example 13:45."
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={e => onChange(normalizeTimeInput(e.target.value))}
      onBlur={() => onChange(normalizeTimeInput(value))}
    />
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
