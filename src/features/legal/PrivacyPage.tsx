import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/**
 * What the app stores, who can see it, and how to make it go away — in the same
 * plain words as the rest of the app. Required before letting other people sign
 * in, and worth writing honestly rather than copying a template nobody reads.
 */
export function PrivacyPage() {
  const { t } = useTranslation()

  const sections = [
    'whatWeKeep',
    'whatIsPublic',
    'whatIsPrivate',
    'where',
    'ai',
    'howLong',
    'deleting',
    'children',
    'contact',
  ] as const

  return (
    <div className="space-y-5 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold">{t('privacy.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('privacy.intro')}</p>
      </header>

      {sections.map((key) => (
        <section key={key}>
          <h2 className="font-semibold">{t(`privacy.${key}.title`)}</h2>
          <p className="mt-1 text-sm leading-relaxed">{t(`privacy.${key}.body`)}</p>
        </section>
      ))}

      <p className="border-t border-line pt-4 text-xs text-muted">
        {t('privacy.updated')} ·{' '}
        <Link to="/me" className="text-accent">
          {t('nav.profile')}
        </Link>
      </p>
    </div>
  )
}
