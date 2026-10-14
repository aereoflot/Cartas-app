import { useTranslation } from 'react-i18next'
import { SampleBanner } from '@/components/SampleBanner'
import { GameSearch } from './GameSearch'

/**
 * The searcher on its own route. It is no longer in the bottom bar — the home
 * screen leads with it — but the route stays, because a filtered search is a
 * link worth sending.
 */
export function SearchPage() {
  const { t } = useTranslation()

  return (
    <div className="px-4 py-4">
      <SampleBanner />
      <h1 className="mb-3 text-xl font-bold">{t('search.title')}</h1>
      <GameSearch variant="full" />
    </div>
  )
}
