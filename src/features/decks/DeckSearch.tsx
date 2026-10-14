import { useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DeckCard } from '@/components/DeckCard'
import { SearchBox } from '@/components/SearchBox'
import { FilterChip } from '@/components/FilterChip'
import { Loading, LoadFailed } from '@/components/QueryState'
import { useDecks } from '@/hooks/useCatalogue'
import { useFavoriteDecks } from '@/hooks/usePrefs'
import { matchesQuery } from '@/lib/search'
import { favouritesFirst } from '@/lib/prefs'

/**
 * Decks. At rest this shows three of them — your starred ones first — because a
 * wall of eight decks is not what you came for. Tap the box and the whole list
 * opens; star more than three and all of your favourites stay listed.
 */

interface Draft {
  kind: string | null
  size: string | null
  favsOnly: boolean
}

const EMPTY: Draft = { kind: null, size: null, favsOnly: false }
const PREVIEW_SIZE = 3

function fromParams(params: URLSearchParams): Draft {
  return {
    kind: params.get('kind'),
    size: params.get('size'),
    favsOnly: params.get('fav') === '1',
  }
}

const countActive = (draft: Draft): number =>
  (draft.kind === null ? 0 : 1) + (draft.size === null ? 0 : 1) + (draft.favsOnly ? 1 : 0)

export function DeckSearch({ inputRef }: { inputRef?: RefObject<HTMLInputElement | null> }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { data: decks, isPending, error } = useDecks()
  const favorites = useFavoriteDecks()

  const q = params.get('q') ?? ''
  const applied = useMemo(() => fromParams(params), [params])
  const appliedCount = countActive(applied)

  const [draft, setDraft] = useState<Draft>(applied)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [opened, setOpened] = useState(false)

  const setQuery = (next: string) => {
    const updated = new URLSearchParams(params)
    if (next === '') updated.delete('q')
    else updated.set('q', next)
    setParams(updated, { replace: true })
  }

  const toggleFilters = () => {
    if (!filtersOpen) setDraft(applied)
    setFiltersOpen(!filtersOpen)
  }

  const apply = (next: Draft) => {
    const updated = new URLSearchParams()
    if (q !== '') updated.set('q', q)
    if (next.kind !== null) updated.set('kind', next.kind)
    if (next.size !== null) updated.set('size', next.size)
    if (next.favsOnly) updated.set('fav', '1')
    setParams(updated, { replace: true })
    setFiltersOpen(false)
    setOpened(true)
  }

  const results = useMemo(() => {
    const matched = (decks ?? []).filter((deck) => {
      if (!matchesQuery(`${deck.name} ${deck.description ?? ''}`, q)) return false
      if (applied.kind !== null && deck.kind !== applied.kind) return false
      if (applied.size === 'small' && deck.cardCount > 40) return false
      if (applied.size === 'medium' && (deck.cardCount <= 40 || deck.cardCount > 54)) return false
      if (applied.size === 'large' && deck.cardCount <= 54) return false
      if (applied.favsOnly && !favorites.includes(deck.slug)) return false
      return true
    })
    // a starred deck goes to the top of the list, which is the point of starring it
    return favouritesFirst(matched, (d) => d.slug, favorites)
  }, [decks, favorites, q, applied])

  const showAll = opened || q !== '' || appliedCount > 0

  const starred = (decks ?? []).filter((d) => favorites.includes(d.slug))
  const preview =
    starred.length > PREVIEW_SIZE
      ? starred
      : favouritesFirst(decks ?? [], (d) => d.slug, favorites).slice(0, PREVIEW_SIZE)

  const shown = showAll ? results : preview
  const hidden = (decks ?? []).length - preview.length

  if (error !== null) return <LoadFailed error={error} />

  return (
    <div>
      <SearchBox
        value={q}
        onChange={setQuery}
        onFocus={() => setOpened(true)}
        onToggleFilters={toggleFilters}
        filtersOpen={filtersOpen}
        filterCount={appliedCount}
        label={t('deck.search')}
        {...(inputRef !== undefined ? { inputRef } : {})}
      />

      {filtersOpen && (
        <div className="mt-3 space-y-3 rounded-card border border-line bg-surface p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
              {t('deck.filterKind')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(['standard', 'variant', 'custom'] as const).map((k) => (
                <FilterChip
                  key={k}
                  on={draft.kind === k}
                  onClick={() => setDraft({ ...draft, kind: draft.kind === k ? null : k })}
                >
                  {t(`deck.kind.${k}`)}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
              {t('deck.filterSize')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(['small', 'medium', 'large'] as const).map((s) => (
                <FilterChip
                  key={s}
                  on={draft.size === s}
                  onClick={() => setDraft({ ...draft, size: draft.size === s ? null : s })}
                >
                  {t(`deck.size.${s}`)}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
              {t('favorites.title')}
            </p>
            <FilterChip
              on={draft.favsOnly}
              onClick={() => setDraft({ ...draft, favsOnly: !draft.favsOnly })}
            >
              {t('favorites.onlyMine')}
            </FilterChip>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => apply(draft)}
              className="flex-1 rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink"
            >
              {t('search.apply')}
            </button>
            {countActive(draft) > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft(EMPTY)
                  apply(EMPTY)
                }}
                className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-muted"
              >
                {t('search.clear')}
              </button>
            )}
          </div>
        </div>
      )}

      {isPending ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
          {t('deck.noneFound')}
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {shown.map((deck) => (
              <DeckCard key={deck.slug} deck={deck} />
            ))}
          </div>
          {!showAll && hidden > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpened(true)
                inputRef?.current?.focus()
              }}
              className="mt-3 w-full rounded-card border border-line bg-surface px-4 py-2.5 text-sm font-medium text-muted"
            >
              {t('deck.showAll', { count: hidden })}
            </button>
          )}
        </>
      )}
    </div>
  )
}
