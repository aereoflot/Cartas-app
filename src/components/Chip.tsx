import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'warn' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/30',
  warn: 'bg-surface-2 text-warn border-warn/30',
  danger: 'bg-surface-2 text-danger border-danger/30',
}

export function Chip({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
