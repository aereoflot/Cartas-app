import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * What a screen shows when it needs an account. Five screens were saying this
 * in five slightly different ways; saying it once means they cannot drift, and
 * that the no-backend case is handled the same everywhere.
 */
export function SignInRequired({ title, reason }: { title: string; reason?: string }) {
  const { t } = useTranslation()

  return (
    <div className="px-4 py-10 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {isSupabaseConfigured ? (reason ?? t('auth.body')) : t('auth.notConfigured')}
      </p>
      {isSupabaseConfigured && (
        <Link
          to="/login"
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"
        >
          {t('auth.signIn')}
        </Link>
      )}
    </div>
  )
}
