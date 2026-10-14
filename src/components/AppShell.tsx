import { NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useSync } from '@/hooks/useSync'
import { InstallInvite } from './InstallInvite'
import { DeckIcon, FriendsIcon, HomeIcon, SparkleIcon } from './icons'

// No search tab: the searcher is the first thing on the home screen, so a tab
// for it would just be a second door into the same room.
const tabs = [
  { to: '/', key: 'home', Icon: HomeIcon },
  { to: '/decks', key: 'decks', Icon: DeckIcon },
  { to: '/friends', key: 'friends', Icon: FriendsIcon },
  { to: '/ai', key: 'expert', Icon: SparkleIcon },
] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  // favourites and folders follow the account while somebody is signed in
  useSync()
  const { pathname } = useLocation()

  // the match panel takes the whole screen: no app chrome competing with the table
  const bare = pathname.startsWith('/matches/')

  const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
  const themeGlyph = theme === 'dark' ? '◑' : theme === 'light' ? '○' : '◐'

  if (bare) return <Outlet />

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <NavLink to="/" className="text-lg font-bold tracking-tight">
          {t('app.name')}
        </NavLink>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es')}
            className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted uppercase"
            aria-label="Language"
          >
            {i18n.language.startsWith('es') ? 'es' : 'en'}
          </button>
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="rounded-full border border-line px-2.5 py-1 text-sm text-muted"
            aria-label={t('common.theme')}
            title={`${t('common.theme')}: ${theme}`}
          >
            {themeGlyph}
          </button>
          <NavLink
            to="/me"
            className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted"
          >
            {t('nav.profile')}
          </NavLink>
        </div>
      </header>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Not over the sign-in form: somebody already there has answered the
          question the sheet is about to ask. */}
      <InstallInvite enabled={pathname !== '/login'} />

      <nav className="safe-bottom fixed bottom-0 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 border-t border-line bg-bg/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {tabs.map(({ to, key, Icon }) => (
            <li key={key}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium ${
                    isActive ? 'text-accent' : 'text-muted'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {t(`nav.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
