import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { createMatch } from '@/lib/matchStore'
import { requirementDeck } from '@/lib/decks'
import { Loading, LoadFailed } from '@/components/QueryState'
import { useGame } from '@/hooks/useCatalogue'
import { useInvitableGroups } from '@/hooks/useInvitableGroups'
import { useSession } from '@/hooks/useSession'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * Setting up a match is where you invite people, because it is the moment you
 * know who is actually playing: how many of you, who they are, which deck, and
 * what you are playing for. Everything after the player count is optional.
 */
export function StartMatchPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: game, isPending, error } = useGame(slug)
  const groups = useInvitableGroups()
  const { session } = useSession()

  // the defaults depend on the game, which arrives later: fall back rather than
  // initialising state from data that is not there yet
  const [chosenCount, setCount] = useState<number | null>(null)
  const [chosenDeck, setDeckSlug] = useState<string | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [stake, setStake] = useState('')
  const [invitedGroup, setInvitedGroup] = useState<string | null>(null)

  if (isPending) return <Loading />
  if (error !== null) return <LoadFailed error={error} />

  if (game === undefined || game === null) {
    return (
      <div className="px-4 py-10 text-center">
        <Link to="/search" className="text-accent">
          {t('search.title')}
        </Link>
      </div>
    )
  }

  const count = chosenCount ?? game.playersBest ?? game.playersMin
  const deckSlug = chosenDeck ?? game.decks[0]?.deckSlug ?? ''

  const options: number[] = []
  for (let n = game.playersMin; n <= game.playersMax; n += 1) options.push(n)

  /** Inviting a group fills the names, and the player count if it fits. */
  const inviteGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (group === undefined) return
    if (invitedGroup === groupId) {
      setInvitedGroup(null)
      setNames([])
      return
    }
    setInvitedGroup(groupId)
    setNames(group.memberNames)
    const size = group.memberNames.length
    if (size >= game.playersMin && size <= game.playersMax) setCount(size)
  }

  const start = () => {
    const match = createMatch({
      gameSlug: game.slug,
      playerCount: count,
      deckSlugs: deckSlug === '' ? [] : [deckSlug],
      playerNames: names.slice(0, count).map((n) => n.trim()).filter((n) => n !== ''),
      stake: stake.trim(),
      // remembering the group makes "our last matches" a fact, not a guess from
      // whichever names were typed that evening
      ...(invitedGroup !== null ? { groupId: invitedGroup } : {}),
    })
    void navigate(`/matches/${match.id}`, { replace: true })
  }

  return (
    <div className="space-y-6 px-4 py-4">
      <header>
        <p className="text-sm text-muted">{game.title}</p>
        <h1 className="text-xl font-bold">{t('match.startTitle')}</h1>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t('match.howMany')}</h2>
        <div className="flex flex-wrap gap-2">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={`h-12 w-12 rounded-full border text-base font-semibold ${
                count === n ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">{t('match.invite')}</h2>
        {groups.length === 0 ? (
          <p className="text-xs text-muted">{t('match.inviteNoGroups')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={invitedGroup === group.id}
                onClick={() => inviteGroup(group.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  invitedGroup === group.id
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                {group.name}
                <span className="ml-1 opacity-70">{group.memberNames.length}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {isSupabaseConfigured && session === null
            ? t('match.invitePending')
            : t('match.inviteLocal')}
        </p>
        <Link to="/friends" className="mt-1 inline-block text-xs font-medium text-accent">
          {t('groups.manage')} →
        </Link>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t('match.names')}</h2>
        <div className="space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              value={names[i] ?? ''}
              onChange={(event) => {
                const next = [...names]
                next[i] = event.target.value
                setNames(next)
                setInvitedGroup(null)
              }}
              placeholder={t('match.namePlaceholder', { n: i + 1 })}
              className="w-full rounded-card border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t('match.whichDeck')}</h2>
        <div className="space-y-2">
          {game.decks.map((req) => {
            const deck = requirementDeck(req)
            return (
              <button
                key={req.deckSlug}
                type="button"
                aria-pressed={deckSlug === req.deckSlug}
                onClick={() => setDeckSlug(req.deckSlug)}
                className={`flex w-full items-baseline justify-between gap-2 rounded-card border px-4 py-3 text-left ${
                  deckSlug === req.deckSlug
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface'
                }`}
              >
                <span className="font-medium">{deck.name}</span>
                {deck.cardCount !== undefined && (
                  <span className="text-xs text-muted">
                    {t('deck.cards', { count: deck.cardCount })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Optional and last: agreeing a prize is the sort of thing you decide while
          shuffling, so it must never stand between you and starting. */}
      <section
        className={
          params.get('reto') === '1'
            ? 'rounded-card border border-accent/40 bg-accent-soft p-4'
            : ''
        }
      >
        <h2 className="mb-1 text-sm font-semibold">{t('match.stake')}</h2>
        <p className="mb-2 text-xs text-muted">{t('match.stakeHint')}</p>
        <input
          value={stake}
          onChange={(event) => setStake(event.target.value)}
          placeholder={t('match.stakePlaceholder')}
          maxLength={120}
          className="w-full rounded-card border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(t('match.stakeIdeas', { returnObjects: true }) as string[]).map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setStake(stake === idea ? '' : idea)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                stake === idea
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {idea}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={start}
        className="w-full rounded-full bg-accent px-4 py-3 text-lg font-semibold text-accent-ink"
      >
        {t('match.start')}
      </button>
    </div>
  )
}
