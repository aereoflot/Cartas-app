import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Deck } from '@/types/cards'
import { toggleDeckInFolder, toggleFavoriteDeck, toggleOwnedDeck } from '@/lib/prefs'
import { useDeckFolders, useFavoriteDecks, useOwnedDecks } from '@/hooks/usePrefs'
import { Chip } from './Chip'
import { FavoriteStar } from './FavoriteStar'

export function DeckCard({ deck }: { deck: Deck }) {
  const { t } = useTranslation()
  const favorites = useFavoriteDecks()
  const owned = useOwnedDecks()
  const folders = useDeckFolders()
  const [showFolders, setShowFolders] = useState(false)

  return (
    <div className="relative">
      <FavoriteStar
        on={favorites.includes(deck.slug)}
        onToggle={() => toggleFavoriteDeck(deck.slug)}
        label={t('favorites.toggleDeck', { name: deck.name })}
      />
      <div className="rounded-card border border-line bg-surface">
        <Link to={`/decks/${deck.slug}`} className="block p-4 pr-12">
          <h3 className="font-semibold">{deck.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {t('deck.cards', { count: deck.cardCount })} · {t(`deck.kind.${deck.kind}`)}
          </p>
          {deck.description !== undefined && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{deck.description}</p>
          )}
          {deck.parentSlug !== undefined && (
            <div className="mt-2">
              <Chip tone="accent">{t('deck.basedOn', { name: deck.parentSlug })}</Chip>
            </div>
          )}
        </Link>

        {/* Owning a deck is the fact every "can we play this" question needs, so
            it is one tap on the deck itself rather than a screen of its own. */}
        <div className="border-t border-line px-4 py-2">
          <button
            type="button"
            aria-pressed={owned.includes(deck.slug)}
            onClick={() => toggleOwnedDeck(deck.slug)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              owned.includes(deck.slug)
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-surface text-muted'
            }`}
          >
            {t('deck.iOwnIt')}
          </button>
        </div>

        {folders.length > 0 && (
          <div className="border-t border-line px-4 py-2">
            <button
              type="button"
              onClick={() => setShowFolders(!showFolders)}
              aria-expanded={showFolders}
              className="text-xs font-medium text-muted"
            >
              {t('folders.addTo')}
            </button>
            {showFolders && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {folders.map((folder) => {
                  const inside = folder.deckSlugs.includes(deck.slug)
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      aria-pressed={inside}
                      onClick={() => toggleDeckInFolder(folder.id, deck.slug)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        inside
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line bg-surface text-muted'
                      }`}
                    >
                      {folder.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
