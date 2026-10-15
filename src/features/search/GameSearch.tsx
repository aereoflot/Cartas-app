import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GameCard } from '@/components/GameCard'
import { SearchBox } from '@/components/SearchBox'
import { Collapsible } from '@/components/Collapsible'
import { FilterChip } from '@/components/FilterChip'
import { Loading, LoadFailed } from '@/components/QueryState'
import { SectionTitle } from '@/components/SectionTitle'
import { useDecks, useGames, useMyUnpublishedGames } from '@/hooks/useCatalogue'
import { useFavoriteGames, useHidesAdult, useOwnedDecks } from '@/hooks/usePrefs'
import { useSession } from '@/hooks/useSession'
import { favouritesFirst } from '@/lib/prefs'
import { matchesQuery } from '@/lib/search'

/**
 * The searcher. Tapping the box opens the list straight away — you should not
 * have to type to find out what there is — and the filters open in a panel
 * right here, grouped into submenus, with one Apply button at the bottom. The
 * applied filters are counted on the Filters button, so a short list never
 * looks like an empty catalogue.
 */

interface Draft {
  players: number | null
  decks: number | null
  minutes: number | null
  complexity: number | null
  deck: string | null
  incomplete: boolean
  mine: boolean
}

const EMPTY: Draft = {
  players: null,
  decks: null,
  minutes: null,
  complexity: null,
  deck: null,
  incomplete: false,
  mine: false,
}

const num = (v: string | null): number | null => {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fromParams(params: URLSearchParams): Draft {
  return {
    players: num(params.get('players')),
    decks: num(params.get('decks')),
    minutes: num(params.get('minutes')),
    complexity: num(params.get('complexity')),
    deck: params.get('deck'),
    incomplete: params.get('incomplete') === '1',
    mine: params.get('mine') === '1',
  }
}

function countActive(draft: Draft): number {
  return (
    (draft.players === null ? 0 : 1) +
    (draft.decks === null ? 0 : 1) +
    (draft.minutes === null ? 0 : 1) +
    (draft.complexity === null ? 0 : 1) +
    (draft.deck === null ? 0 : 1) +
    (draft.incomplete ? 1 : 0) +
    (draft.mine ? 1 : 0)
  )
}

export function GameSearch({ variant }: { variant: 'home' | 'full' }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { data: games, isPending, error } = useGames()
  const { data: decks } = useDecks()
  const favorites = useFavoriteGames()
  const owned = useOwnedDecks()
  const hideAdult = useHidesAdult()
  const { session } = useSession()
  const mineQuery = useMyUnpublishedGames(session?.user.id)

  const q = params.get('q') ?? ''
  const applied = useMemo(() => fromParams(params), [params])
  const appliedCount = countActive(applied)

  const [draft, setDraft] = useState<Draft>(applied)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // on the home screen the list waits for the box to be touched, not for typing
  const [opened, setOpened] = useState(variant === 'full')

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
    if (next.players !== null) updated.set('players', String(next.players))
    if (next.decks !== null) updated.set('decks', String(next.decks))
    if (next.minutes !== null) updated.set('minutes', String(next.minutes))
    if (next.complexity !== null) updated.set('complexity', String(next.complexity))
    if (next.deck !== null) updated.set('deck', next.deck)
    if (next.incomplete) updated.set('incomplete', '1')
    if (next.mine) updated.set('mine', '1')
    setParams(updated, { replace: true })
    setFiltersOpen(false)
    setOpened(true)
  }

  const results = useMemo(() => {
    const matched = (games ?? []).filter((g) => {
      if (!matchesQuery(`${g.title} ${g.tagline ?? ''} ${g.summary}`, q)) return false
      if (applied.players !== null
        && (applied.players < g.playersMin || applied.players > g.playersMax)) return false
      if (applied.decks !== null && g.deckCountTotal > applied.decks) return false
      if (applied.minutes !== null && (g.durationMin ?? 0) > applied.minutes) return false
      if (applied.complexity !== null && (g.complexity ?? 1) > applied.complexity) return false
      if (applied.deck !== null && !g.decks.some((d) => d.deckSlug === applied.deck)) return false
      // "my deck is incomplete" rules out games that need every card
      if (applied.incomplete && g.missingCardsPolicy === 'strict') return false
      // "only with the decks I own": answered here, on the device, because this
      // is the question you ask at a table with no signal
      if (applied.mine && !g.decks.every((deck) => owned.includes(deck.deckSlug))) return false
      // a personal setting, not a filter: 18+ games stay out while it is on
      if (hideAdult && g.adultOnly) return false
      return true
    })
    return favouritesFirst(matched, (g) => g.slug, favorites)
  }, [games, favorites, owned, hideAdult, q, applied])

  /**
   * Your own drafts and submissions, matched the same way. Sending a game for
   * review does not take it away from you: it stays findable here, labelled, so
   * you can play from it while it waits.
   */
  const mine = useMemo(
    () =>
      (mineQuery.data ?? []).filter(({ game }) =>
        matchesQuery(`${game.title} ${game.tagline ?? ''} ${game.summary}`, q),
      ),
    [mineQuery.data, q],
  )

  const showResults = opened || q !== '' || appliedCount > 0
  const createHref = q === '' ? '/games/new' : `/games/new?title=${encodeURIComponent(q)}`

  return (
    <div>
      <SearchBox
        value={q}
        onChange={setQuery}
        onFocus={() => setOpened(true)}
        onToggleFilters={toggleFilters}
        filtersOpen={filtersOpen}
        filterCount={appliedCount}
        label={t('search.title')}
      />

      {filtersOpen && (
        <div className="mt-3 rounded-card border border-line bg-surface px-3">
          <Collapsible
            title={t('search.players')}
            summary={draft.players === null ? '' : String(draft.players)}
          >
            <div className="flex flex-wrap gap-1.5">
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <FilterChip
                  key={n}
                  on={draft.players === n}
                  onClick={() =>
                    setDraft({ ...draft, players: draft.players === n ? null : n })
                  }
                >
                  {n}
                </FilterChip>
              ))}
            </div>
          </Collapsible>

          <Collapsible
            title={t('search.deckCount')}
            summary={draft.decks === null ? '' : `≤ ${draft.decks}`}
          >
            <div className="flex flex-wrap gap-1.5">
              {[1, 2].map((n) => (
                <FilterChip
                  key={n}
                  on={draft.decks === n}
                  onClick={() => setDraft({ ...draft, decks: draft.decks === n ? null : n })}
                >
                  ≤ {n}
                </FilterChip>
              ))}
            </div>
          </Collapsible>

          <Collapsible
            title={t('search.deckType')}
            summary={
              draft.deck === null
                ? ''
                : (decks ?? []).find((d) => d.slug === draft.deck)?.name ?? draft.deck
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {(decks ?? []).map((d) => (
                <FilterChip
                  key={d.slug}
                  on={draft.deck === d.slug}
                  onClick={() =>
                    setDraft({ ...draft, deck: draft.deck === d.slug ? null : d.slug })
                  }
                >
                  {d.name}
                </FilterChip>
              ))}
            </div>
          </Collapsible>

          <Collapsible
            title={t('search.duration')}
            summary={draft.minutes === null ? '' : `≤ ${draft.minutes} ${t('common.minutes')}`}
          >
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 60].map((n) => (
                <FilterChip
                  key={n}
                  on={draft.minutes === n}
                  onClick={() => setDraft({ ...draft, minutes: draft.minutes === n ? null : n })}
                >
                  ≤ {n} {t('common.minutes')}
                </FilterChip>
              ))}
            </div>
          </Collapsible>

          <Collapsible
            title={t('search.complexity')}
            summary={draft.complexity === null ? '' : `≤ ${draft.complexity}`}
          >
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <FilterChip
                  key={n}
                  on={draft.complexity === n}
                  onClick={() =>
                    setDraft({ ...draft, complexity: draft.complexity === n ? null : n })
                  }
                >
                  ≤ {n}
                </FilterChip>
              ))}
            </div>
          </Collapsible>

          <Collapsible
            title={t('search.other')}
            summary={[draft.mine ? t('search.mineOnly') : '', draft.incomplete ? t('search.incomplete') : '']
              .filter((part) => part !== '')
              .join(' · ')}
          >
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                on={draft.mine}
                onClick={() => setDraft({ ...draft, mine: !draft.mine })}
              >
                {t('search.mineOnly')}
              </FilterChip>
              <FilterChip
                on={draft.incomplete}
                onClick={() => setDraft({ ...draft, incomplete: !draft.incomplete })}
              >
                {t('search.incomplete')}
              </FilterChip>
            </div>
            {draft.mine && owned.length === 0 && (
              <p className="mt-2 text-xs text-muted">{t('search.noDecksOwned')}</p>
            )}
          </Collapsible>

          <div className="flex items-center gap-2 py-3">
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

      {error !== null && <LoadFailed error={error} />}

      {error === null && showResults && (
        isPending ? (
          <Loading />
        ) : (
          <>
            {results.length > 0 && (
              <div className="mt-4 space-y-2">
                {results.map((g) => (
                  <GameCard key={g.slug} game={g} />
                ))}
              </div>
            )}

            {mine.length > 0 && (
              <section className="mt-5">
                <SectionTitle>{t('search.mineUnpublished')}</SectionTitle>
                <div className="space-y-2">
                  {mine.map(({ game, status }) => (
                    <GameCard key={game.slug} game={game} status={status} />
                  ))}
                </div>
              </section>
            )}

            {/* A filter that excludes everything is not an invitation to write a
                game, so that case keeps its own message. A name nobody has is. */}
            {results.length === 0 && mine.length === 0 && q === '' && (
              <p className="mt-4 rounded-card border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                {t('search.empty')}
              </p>
            )}

            <Link
              to={createHref}
              className="mt-4 block rounded-card border border-dashed border-accent/50 bg-accent-soft/50 px-4 py-4 text-center"
            >
              <span className="block font-semibold text-accent">
                {q === '' ? t('search.createAny') : t('search.createNamed', { name: q })}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {q === '' ? t('search.createAnyBody') : t('search.createNamedBody')}
              </span>
            </Link>
          </>
        )
      )}
    </div>
  )
}
