import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="px-4 py-16 text-center">
      <p className="font-mono text-4xl font-bold">404</p>
      <Link to="/" className="mt-4 inline-block font-medium text-accent">
        {t('nav.home')}
      </Link>
    </div>
  )
}
