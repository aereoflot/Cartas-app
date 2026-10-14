import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchIcon } from './icons'

/**
 * A search field with the filters beside it, opened in place — never on another
 * page. The button carries a count of how many filters are currently applied,
 * so you can see that a short list is a filtered list.
 */
export function SearchBox({
  value,
  onChange,
  onFocus,
  onToggleFilters,
  filtersOpen,
  filterCount = 0,
  label,
  inputRef,
}: {
  value: string
  onChange: (next: string) => void
  onFocus?: () => void
  onToggleFilters: () => void
  filtersOpen: boolean
  filterCount?: number
  label: string
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder={t('search.placeholder')}
          aria-label={label}
          className="w-full rounded-full border border-line bg-surface py-2.5 pr-4 pl-10 text-base outline-none focus:border-accent"
        />
      </div>

      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-medium ${
          filtersOpen || filterCount > 0
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-line bg-surface text-muted'
        }`}
      >
        {t('search.filters')}
        {filterCount > 0 && (
          <span
            aria-label={t('search.filtersApplied', { count: filterCount })}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-ink px-1 text-xs font-bold text-accent"
          >
            {filterCount}
          </span>
        )}
      </button>
    </div>
  )
}
