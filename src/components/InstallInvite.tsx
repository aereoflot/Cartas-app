import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useInstallInvite, useInstallOffer } from '@/hooks/useInstallPrompt'
import { useSession } from '@/hooks/useSession'
import { isSupabaseConfigured } from '@/lib/supabase'
import { InstallSteps } from './InstallSteps'

/**
 * The welcome sheet: install the app, and decide whether to do it as somebody or
 * as nobody. Both questions arrive once, together, because they are the same
 * question from the user's side — "what is this and do I have to sign up?" — and
 * two pop-ups in a row is how you get closed twice.
 *
 * The install button is always there and always pressable. If the browser gave
 * us its dialog, it opens it; if not, pressing it opens the instructions. What
 * it never does is turn into a paragraph while somebody is reaching for it.
 */
export function InstallInvite({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useSession()
  const { offered, dismiss } = useInstallInvite(enabled)
  const { ready, route, install } = useInstallOffer()
  const [steps, setSteps] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offered) return
    sheet.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [offered, dismiss])

  if (!offered) return null

  // Nothing to offer somebody already signed in, and nothing to promise about
  // accounts while there is no backend to hold them.
  const askAboutAccount = isSupabaseConfigured && session === null

  const tryInstall = async () => {
    const outcome = await install()
    // No dialog to open: the instructions are the answer, in place, without
    // having moved the button out from under them.
    if (outcome === 'unavailable') setSteps(true)
    else dismiss()
  }

  const createAccount = () => {
    dismiss()
    void navigate('/login')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        tabIndex={-1}
        className="safe-bottom w-full max-w-md rounded-t-[1.75rem] border border-line bg-surface px-5 pb-4 pt-3 outline-none sm:rounded-card sm:pt-5"
      >
        {/* the grab handle says "this slides away" without a word of copy */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />

        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-[0.85rem] border border-line"
          />
          <div className="min-w-0">
            <h2 id="install-title" className="text-base font-bold leading-tight">
              {t('install.title')}
            </h2>
            <p className="mt-1 text-sm leading-snug text-muted">{t('install.body')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void tryInstall()}
          className="mt-4 w-full rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink"
        >
          {t('install.cta')}
        </button>

        {steps ? (
          <div className="mt-3">
            <InstallSteps route={route} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSteps(true)}
            className="mt-2 w-full text-center text-xs font-medium text-muted underline decoration-line underline-offset-2"
          >
            {ready ? t('install.notWorking') : t('install.howTo')}
          </button>
        )}

        {askAboutAccount && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-semibold">{t('install.accountTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t('install.accountBody')}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={createAccount}
                className="flex-1 rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent"
              >
                {t('install.createAccount')}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-medium"
              >
                {t('install.guest')}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full py-2 text-center text-sm font-medium text-muted"
        >
          {t('install.later')}
        </button>
      </div>
    </div>
  )
}
