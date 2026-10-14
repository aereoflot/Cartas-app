import { useTranslation } from 'react-i18next'

/**
 * How to install by hand. Shown when the browser never offered a dialog, and
 * reachable on purpose from behind a link when it did but something went wrong.
 */
export function InstallSteps({ route }: { route: 'ios' | 'other' }) {
  const { t } = useTranslation()
  const keys = route === 'ios' ? ['install.ios1', 'install.ios2'] : ['install.manual1', 'install.manual2']

  return (
    <ol className="space-y-2 rounded-card bg-surface-2 px-4 py-3 text-sm">
      {keys.map((key, i) => (
        <li key={key} className="flex gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.7rem] font-bold text-accent">
            {i + 1}
          </span>
          <span className="leading-snug">{t(key)}</span>
        </li>
      ))}
    </ol>
  )
}
