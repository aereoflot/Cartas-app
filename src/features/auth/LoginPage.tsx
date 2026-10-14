import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { sendMagicLink } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() === '') return
    setStatus({ kind: 'sending' })
    try {
      await sendMagicLink(email.trim())
      setStatus({ kind: 'sent' })
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="px-4 py-10">
        <h1 className="text-xl font-bold">{t('auth.title')}</h1>
        <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
          {t('auth.notConfigured')}
        </p>
      </div>
    )
  }

  if (status.kind === 'sent') {
    return (
      <div className="px-4 py-10 text-center">
        <h1 className="text-xl font-bold">{t('auth.sentTitle')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          {t('auth.sentBody', { email })}
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="mt-5 text-sm font-medium text-accent"
        >
          {t('auth.useAnother')}
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-10">
      <h1 className="text-xl font-bold">{t('auth.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('auth.body')}</p>

      <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('auth.email')}</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full rounded-card border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
          />
        </label>

        <button
          type="submit"
          disabled={status.kind === 'sending'}
          className="w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60"
        >
          {status.kind === 'sending' ? t('auth.sending') : t('auth.send')}
        </button>

        {status.kind === 'error' && (
          <p role="alert" className="text-sm text-danger">
            {status.message}
          </p>
        )}
      </form>

      <p className="mt-6 text-xs text-muted">
        {t('auth.noPassword')}{' '}
        <Link to="/privacidad" className="text-accent">
          {t('auth.privacy')}
        </Link>
      </p>
    </div>
  )
}
