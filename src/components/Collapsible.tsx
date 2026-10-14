import { useState } from 'react'
import type { ReactNode } from 'react'

/** One submenu inside a filter panel: a heading you tap to open. */
export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
      >
        <span className="text-sm font-medium">{title}</span>
        <span className="flex items-center gap-2">
          {summary !== undefined && summary !== '' && (
            <span className="text-xs text-accent">{summary}</span>
          )}
          <span className="text-muted" aria-hidden="true">
            {open ? '−' : '+'}
          </span>
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}
