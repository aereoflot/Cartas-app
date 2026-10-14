import type { ReactNode } from 'react'

/** A single on/off filter value. */
export function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
        on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  )
}
