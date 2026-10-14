import { useTranslation } from 'react-i18next'
import { isSupabaseConfigured } from '@/lib/supabase'

/** Says plainly that the catalogue is sample data, so nobody mistakes it for real. */
export function SampleBanner() {
  const { t } = useTranslation()
  if (isSupabaseConfigured) return null

  return (
    <div className="mx-4 mb-4 rounded-card border border-warn/30 bg-surface-2 px-3 py-2">
      <p className="text-xs font-semibold text-warn">{t('common.sampleData')}</p>
      <p className="mt-0.5 text-xs text-muted">{t('common.sampleDataBody')}</p>
    </div>
  )
}
