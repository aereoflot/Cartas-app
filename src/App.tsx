import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { SearchPage } from '@/features/search/SearchPage'
import { GameDetailPage } from '@/features/games/GameDetailPage'
import { DecksPage } from '@/features/decks/DecksPage'
import { DeckDetailPage } from '@/features/decks/DeckDetailPage'
import { StartMatchPage } from '@/features/matches/StartMatchPage'
import { MatchPage } from '@/features/matches/MatchPage'
import { MatchHistoryPage } from '@/features/matches/MatchHistoryPage'
import { NotFoundPage } from '@/features/NotFoundPage'
import { PrivacyPage } from '@/features/legal/PrivacyPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NewPasswordPage } from '@/features/auth/NewPasswordPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { FriendsPage } from '@/features/friends/FriendsPage'
import { Loading } from '@/components/QueryState'

// Loaded on demand: the editor, the expert and the review queue are big and
// rarely the reason somebody opened the app, and this is a phone-first app where
// the first load is the one that matters.
const GameEditorPage = lazy(() =>
  import('@/features/games/GameEditorPage').then((m) => ({ default: m.GameEditorPage })),
)
const AiPage = lazy(() => import('@/features/ai/AiPage').then((m) => ({ default: m.AiPage })))
const ReviewQueuePage = lazy(() =>
  import('@/features/admin/ReviewQueuePage').then((m) => ({ default: m.ReviewQueuePage })),
)

/** The route tree, separate from the router so tests can mount it in memory. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="games/new" element={<Lazy><GameEditorPage /></Lazy>} />
        <Route path="games/:slug" element={<GameDetailPage />} />
        <Route path="games/:slug/edit" element={<Lazy><GameEditorPage /></Lazy>} />
        <Route path="games/:slug/play" element={<StartMatchPage />} />
        <Route path="matches" element={<MatchHistoryPage />} />
        <Route path="matches/:id" element={<MatchPage />} />
        <Route path="decks" element={<DecksPage />} />
        <Route path="decks/:slug" element={<DeckDetailPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="me" element={<ProfilePage />} />
        <Route path="ai" element={<Lazy><AiPage /></Lazy>} />
        <Route path="admin/review" element={<Lazy><ReviewQueuePage /></Lazy>} />
        <Route path="login" element={<LoginPage />} />
        {/* where the recovery email lands; the path is in the email, so it does
            not change without invalidating every link already sent */}
        <Route path="nueva-contrasena" element={<NewPasswordPage />} />
        <Route path="privacidad" element={<PrivacyPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
)

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
