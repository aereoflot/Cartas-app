import { useState } from 'react'
import type { RulesSection } from '@/types/cards'
import { Markdown } from './Markdown'

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')

/**
 * Rules as collapsible sections with a jump list. At a table you want one
 * section, not a wall of text — and the jump list is what the match panel uses.
 */
export function RulesSections({
  sections,
  jumpLabel,
}: {
  sections: RulesSection[]
  jumpLabel: string
}) {
  const [open, setOpen] = useState<string | null>(sections[0]?.heading ?? null)

  return (
    <div>
      <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {sections.map((s) => (
          <button
            key={s.heading}
            type="button"
            onClick={() => setOpen(s.heading)}
            aria-label={`${jumpLabel}: ${s.heading}`}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
              open === s.heading
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-muted'
            }`}
          >
            {s.heading}
          </button>
        ))}
      </nav>

      <div className="space-y-2">
        {sections.map((s) => {
          const isOpen = open === s.heading
          return (
            <section
              key={s.heading}
              id={slug(s.heading)}
              className="rounded-card border border-line bg-surface"
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : s.heading)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold"
                >
                  {s.heading}
                  <span className="text-muted" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div className="border-t border-line px-4 py-3">
                  <Markdown body={s.body} />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
