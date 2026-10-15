import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInstallOffer } from '@/hooks/useInstallPrompt'
import { canInstallAtAll } from '@/lib/install'
import { InstallSteps } from './InstallSteps'

/**
 * The way back in. The welcome sheet asks once and then stays quiet for a
 * month, so someone who tapped "not now" and changed their mind needs a door
 * that is always open — and this is the tab they go looking in.
 *
 * Nothing is rendered where installing is impossible or already done: an offer
 * that cannot be honoured is worse than no offer.
 *
 * `bare` drops the card and the heading, for when it sits inside a drawer that
 * already says what it is.
 */
export function InstallSection({ bare = false }: { bare?: boolean } = {}) {
  const { t } = useTranslation()
  const { route, install } = useInstallOffer()
  const [steps, setSteps] = useState(false)
  const [installed, setInstalled] = useState(false)

  const [possible] = useState(() => {
    try {
      return canInstallAtAll()
    } catch {
      return false
    }
  })
  if (!possible) return null

  const tryInstall = async () => {
    const outcome = await install()
    if (outcome === 'unavailable') setSteps(true)
    if (outcome === 'accepted') setInstalled(true)
  }

  const Wrapper = bare ? 'div' : 'section'

  return (
    <Wrapper className={bare ? '' : 'rounded-card border border-line bg-surface p-4'}>
      {!bare && <h2 className="font-semibold">{t('install.profileTitle')}</h2>}
      <p className={`text-sm text-muted${bare ? '' : ' mt-1'}`}>{t('install.profileBody')}</p>

      {installed ? (
        <p className="mt-3 text-sm font-medium text-accent">{t('install.installed')}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void tryInstall()}
            className="mt-3 w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink"
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
              {t('install.howTo')}
            </button>
          )}
        </>
      )}
    </Wrapper>
  )
}
