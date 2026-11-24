import type { ButtonHTMLAttributes, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import './crewlist-ui.css'

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ')
}

/** Crewlist brand mark. Wrap in a button or link only when it navigates. */
export function CrewlistBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={classes('cl-brand', compact && 'cl-brand--compact')}>
      <span className="cl-brand__mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Crewlist</span>
    </span>
  )
}

export function TeamBrand({ teamName }: { teamName: string }) {
  return (
    <span className="cl-team-brand">
      <span>{teamName}</span>
      <span>by Crewlist</span>
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
  size?: 'default' | 'small'
  full?: boolean
  loading?: boolean
}

export function ClButton({
  variant = 'primary',
  size = 'default',
  full = false,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes('cl-button', `cl-button--${variant}`, size === 'small' && 'cl-button--small', full && 'cl-button--full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="cl-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
}

export function ClInput({ id, label, hint, error, optional = false, className, ...props }: InputProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className={classes('cl-field', className)}>
      <div className="cl-field__label-row">
        <label className="cl-label" htmlFor={id}>{label}</label>
        {optional && <span className="cl-field__optional">Optional</span>}
      </div>
      <input
        id={id}
        className={classes('cl-input', error && 'cl-input--error')}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
      {error ? <p className="cl-field__error" id={errorId} role="alert">{error}</p>
        : hint ? <p className="cl-field__hint" id={hintId}>{hint}</p> : null}
    </div>
  )
}

export function ClStatus({
  tone = 'neutral',
  children,
  label,
}: {
  tone?: 'neutral' | 'open' | 'selected' | 'warning' | 'danger'
  children: ReactNode
  label?: string
}) {
  return <span className={classes('cl-status', `cl-status--${tone}`)} aria-label={label}><span aria-hidden="true" />{children}</span>
}

export function ClNotice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={classes('cl-notice', `cl-notice--${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <div><strong>{title}</strong><div className="cl-notice__body">{children}</div></div>
      {action && <div className="cl-notice__action">{action}</div>}
    </div>
  )
}

export function ClTabs({
  idPrefix,
  items,
  active,
  onChange,
  label,
}: {
  idPrefix: string
  items: Array<{ id: string; label: string }>
  active: string
  onChange: (id: string) => void
  label: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length
    onChange(items[next].id)
    document.getElementById(`${idPrefix}-${items[next].id}`)?.focus()
  }

  return (
    <div className="cl-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`${idPrefix}-${item.id}`}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={active === item.id ? 0 : -1}
          className={classes('cl-tab', active === item.id && 'cl-tab--active')}
          onClick={() => onChange(item.id)}
          onKeyDown={event => onKeyDown(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function ClSkeleton({ rows = 3, label = 'Loading races' }: { rows?: number; label?: string }) {
  return (
    <div className="cl-skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="cl-skeleton-row" key={index} aria-hidden="true">
          <span className="cl-skeleton cl-skeleton--date" />
          <span><span className="cl-skeleton cl-skeleton--title" /><span className="cl-skeleton cl-skeleton--meta" /></span>
        </div>
      ))}
      <span className="cl-sr-only">{label}</span>
    </div>
  )
}

export function ClEmpty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="cl-empty">
      <span className="cl-empty__mark" aria-hidden="true">/</span>
      <h3>{title}</h3>
      <p>{hint}</p>
      {action}
    </div>
  )
}

export function ClPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="cl-page-header">
      <div>
        <p className="cl-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="cl-page-header__description">{description}</p>}
      </div>
      {actions && <div className="cl-page-header__actions">{actions}</div>}
    </div>
  )
}
