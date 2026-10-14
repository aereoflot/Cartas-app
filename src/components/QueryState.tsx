import { useTranslation } from 'react-i18next'

/** Loading and error states, said plainly and in one place. */
export function Loading() {
  const { t } = useTranslation()
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-muted">
      {t('common.loading')}
    </p>
  )
}

export function LoadFailed({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const detail = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="mx-4 my-6 rounded-card border border-danger/40 px-4 py-4">
      <p className="text-sm font-semibold text-danger">{t('common.loadFailed')}</p>
      <p className="mt-1 font-mono text-xs break-words text-muted">{detail}</p>
    </div>
  )
}
