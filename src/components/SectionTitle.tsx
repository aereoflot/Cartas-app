import type { ReactNode } from 'react'

/** The small upper-case heading used above every block in the app. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}
