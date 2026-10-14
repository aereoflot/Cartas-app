import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cardsPerSuit, computedCardCount } from '@/types/cards'
import { GameCard } from '@/components/GameCard'
import { Loading, LoadFailed } from '@/components/QueryState'
import { useDeck, useGames } from '@/hooks/useCatalogue'
import { SectionTitle } from '@/components/SectionTitle'

const suitColor: Record<string, string> = {
  gold: 'text-suit-gold',
  red: 'text-suit-red',
  blue: 'text-suit-blue',
  green: 'text-suit-green',
  black: 'text-suit-black',
  brown: 'text-suit-brown',
  yellow: 'text-suit-yellow',
  grey: 'text-suit-grey',
}

export function DeckDetailPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { data: deck, isPending, error } = useDeck(slug)
  const { data: games } = useGames()

  if (isPending) return <Loading />
  if (error !== null) return <LoadFailed error={error} />

  if (deck === undefined || deck === null) {
    return (
      <div className="px-4 py-10 text-center">
        <Link to="/decks" className="text-accent">
          {t('nav.decks')}
        </Link>
      </div>
    )
  }

  const forThisDeck = (games ?? []).filter((g) =>
    g.decks.some((d) => d.deckSlug === deck.slug),
  )

  return (
    <div className="space-y-5 px-4 py-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{deck.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('deck.cards', { count: deck.cardCount })} · {t(`deck.kind.${deck.kind}`)}
        </p>
        {deck.description !== undefined && <p className="mt-2 text-sm">{deck.description}</p>}
      </header>

      {/* the whole deck, laid out: one row per suit */}
      <section>
        <SectionTitle>{deck.suits.length} {t('deck.suits')} × {cardsPerSuit(deck)}</SectionTitle>
        <div className="space-y-2">
          {deck.suits.map((suit) => (
            <div key={suit.key} className="rounded-card border border-line bg-surface p-3">
              <p className={`mb-2 text-sm font-semibold ${suitColor[suit.color] ?? ''}`}>
                <span aria-hidden="true">{suit.symbol}</span> {suit.name}
              </p>
              <div className="flex flex-wrap gap-1">
                {[...deck.ranks]
                  .sort((a, b) => a.order - b.order)
                  .map((rank) => (
                    <span
                      key={rank.key}
                      className="flex h-9 min-w-8 items-center justify-center rounded border border-line bg-surface-2 px-1 text-xs font-medium"
                      title={`${rank.label} de ${suit.name}`}
                    >
                      {rank.label}
                      {(rank.copies ?? 1) > 1 && (
                        <span className="ml-0.5 text-muted">×{rank.copies}</span>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {deck.extras.length > 0 && (
        <section>
          <SectionTitle>{t('deck.extras')}</SectionTitle>
          <ul className="space-y-1 text-sm">
            {deck.extras.map((extra) => (
              <li key={extra.key}>
                {extra.count}× {extra.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* a visible cross-check that the stored count matches the structure */}
      {computedCardCount(deck) !== deck.cardCount && (
        <p className="rounded-card border border-danger/40 px-3 py-2 text-sm text-danger">
          card_count {deck.cardCount} ≠ {computedCardCount(deck)}
        </p>
      )}

      {forThisDeck.length > 0 && (
        <section>
          <SectionTitle>{t('deck.games')}</SectionTitle>
          <div className="space-y-2">
            {forThisDeck.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
