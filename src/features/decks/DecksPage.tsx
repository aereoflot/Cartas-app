import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SampleBanner } from '@/components/SampleBanner'
import { DeckSearch } from './DeckSearch'
import { createDeckFolder, deleteDeckFolder } from '@/lib/prefs'
import { useDeckFolders } from '@/hooks/usePrefs'
import { useDecks } from '@/hooks/useCatalogue'
import { SectionTitle } from '@/components/SectionTitle'

export function DecksPage() {
  const { t } = useTranslation()
  const folders = useDeckFolders()
  const { data: decks } = useDecks()
  const [newFolder, setNewFolder] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  /** "Add decks" from a folder sends you to the searcher above, open and focused. */
  const goToSearch = () => {
    searchRef.current?.focus()
    searchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const nameOf = (slug: string) => decks?.find((d) => d.slug === slug)?.name ?? slug

  const addFolder = () => {
    const name = newFolder.trim()
    if (name === '') return
    createDeckFolder(name)
    setNewFolder('')
  }

  return (
    <div className="px-4 py-4">
      <SampleBanner />
      <h1 className="mb-3 text-xl font-bold">{t('nav.decks')}</h1>

      <DeckSearch inputRef={searchRef} />

      <section className="mt-8">
        <SectionTitle>{t('folders.title')}</SectionTitle>

        {folders.length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
            {t('folders.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {folders.map((folder) => (
              <li key={folder.id} className="rounded-card border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{folder.name}</h3>
                  <button
                    type="button"
                    onClick={() => deleteDeckFolder(folder.id)}
                    aria-label={t('folders.delete', { name: folder.name })}
                    className="text-xs font-medium text-danger"
                  >
                    {t('folders.delete', { name: '' }).trim()}
                  </button>
                </div>
                {folder.deckSlugs.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">{t('folders.howToAdd')}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {folder.deckSlugs.map((slug) => (
                      <Link
                        key={slug}
                        to={`/decks/${slug}`}
                        className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs"
                      >
                        {nameOf(slug)}
                      </Link>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={goToSearch}
                  className="mt-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
                >
                  {t('folders.addDecks')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={newFolder}
            onChange={(event) => setNewFolder(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addFolder()
            }}
            placeholder={t('folders.placeholder')}
            aria-label={t('folders.new')}
            className="min-w-0 flex-1 rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={addFolder}
            className="shrink-0 rounded-card bg-accent px-4 py-2 font-medium text-accent-ink"
          >
            {t('folders.new')}
          </button>
        </div>
      </section>
    </div>
  )
}
