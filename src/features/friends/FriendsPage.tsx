import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FoundPerson } from '@/lib/friends'
import {
  acceptFriend,
  listFriends,
  removeFriendship,
  requestFriend,
  searchPeople,
} from '@/lib/friends'
import { useSession } from '@/hooks/useSession'
import { Loading, LoadFailed } from '@/components/QueryState'
import { SearchIcon } from '@/components/icons'
import { SignInRequired } from '@/components/SignInRequired'
import { CloudGroups } from './CloudGroups'
import { LocalGroups } from './LocalGroups'
import { SectionTitle } from '@/components/SectionTitle'

/**
 * Friends are found by their handle, never by their email address: asking for an
 * email would tell you whether an address has an account here, and it is a
 * worse thing to hand around than a name somebody chose to publish.
 */
export function FriendsPage() {
  const { session } = useSession()
  const myId = session?.user.id
  const signedIn = myId !== undefined

  return (
    <div className="space-y-8 px-4 py-4">
      {signedIn ? <FriendsSection myId={myId} /> : <SignedOutNote />}
      <InviteSection />
      {/* With an account the groups live up there, with real friends in them and
          a chat that reaches people. Without one they stay on the phone. */}
      {signedIn ? <CloudGroups myId={myId} /> : <LocalGroups />}
    </div>
  )
}

function SignedOutNote() {
  const { t } = useTranslation()
  return <SignInRequired title={t('friends.list')} reason={t('friends.needsAccount')} />
}

function FriendsSection({ myId }: { myId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')

  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends })
  const found = useQuery({
    queryKey: ['people', query.trim()],
    queryFn: () => searchPeople(query),
    enabled: query.trim().length >= 2,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends'] })
    void queryClient.invalidateQueries({ queryKey: ['people'] })
  }

  const ask = useMutation({
    mutationFn: (them: string) => requestFriend(myId, them),
    onSuccess: refresh,
  })
  const accept = useMutation({
    mutationFn: (them: string) => acceptFriend(myId, them),
    onSuccess: refresh,
  })
  const drop = useMutation({
    mutationFn: (them: string) => removeFriendship(myId, them),
    onSuccess: refresh,
  })

  const action = (person: FoundPerson) => {
    switch (person.link) {
      case 'none':
        return (
          <button
            type="button"
            onClick={() => ask.mutate(person.id)}
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
          >
            {t('friends.add')}
          </button>
        )
      case 'outgoing':
        return <span className="text-xs text-muted">{t('friends.sent')}</span>
      case 'incoming':
        return (
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => accept.mutate(person.id)}
              className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
            >
              {t('friends.accept')}
            </button>
            <button
              type="button"
              onClick={() => drop.mutate(person.id)}
              className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted"
            >
              {t('friends.decline')}
            </button>
          </span>
        )
      case 'friends':
        return (
          <button
            type="button"
            onClick={() => drop.mutate(person.id)}
            className="text-xs font-medium text-danger"
          >
            {t('friends.remove')}
          </button>
        )
      case 'blocked':
        return <span className="text-xs text-muted">{t('friends.blocked')}</span>
    }
  }

  const row = (person: FoundPerson) => (
    <li
      key={person.id}
      className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{person.displayName}</span>
        <span className="text-xs text-muted">@{person.username}</span>
      </span>
      {action(person)}
    </li>
  )

  const accepted = (friends.data ?? []).filter((p) => p.link === 'friends')
  const incoming = (friends.data ?? []).filter((p) => p.link === 'incoming')
  const outgoing = (friends.data ?? []).filter((p) => p.link === 'outgoing')

  return (
    <>
      <section>
        <h1 className="text-xl font-bold">{t('friends.list')}</h1>

        {friends.error !== null ? (
          <LoadFailed error={friends.error} />
        ) : friends.isPending ? (
          <Loading />
        ) : (
          <>
            {incoming.length > 0 && (
              <>
                <h2 className="mt-3 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {t('friends.requests')}
                </h2>
                <ul className="space-y-2">{incoming.map(row)}</ul>
              </>
            )}

            {accepted.length === 0 ? (
              <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
                {t('friends.noneYet')}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">{accepted.map(row)}</ul>
            )}

            {outgoing.length > 0 && (
              <>
                <h2 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {t('friends.waiting')}
                </h2>
                <ul className="space-y-2">{outgoing.map(row)}</ul>
              </>
            )}
          </>
        )}
      </section>

      <section>
        <SectionTitle>{t('friends.find')}</SectionTitle>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('friends.findPlaceholder')}
            aria-label={t('friends.find')}
            autoCapitalize="none"
            className="w-full rounded-full border border-line bg-surface py-2.5 pr-4 pl-10 outline-none focus:border-accent"
          />
        </div>
        <p className="mt-1 text-xs text-muted">{t('friends.findHint')}</p>

        {query.trim().length >= 2 && (
          found.isPending ? (
            <Loading />
          ) : found.error !== null ? (
            <LoadFailed error={found.error} />
          ) : (found.data ?? []).length === 0 ? (
            <p className="mt-3 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
              {t('friends.nobodyFound', { q: query.trim() })}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">{(found.data ?? []).map(row)}</ul>
          )
        )}
      </section>
    </>
  )
}

function InviteSection() {
  const { t } = useTranslation()

  const invite = async () => {
    const url = window.location.origin
    const text = t('friends.inviteText')
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: t('app.name'), text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      window.alert(t('friends.inviteCopied'))
    } catch {
      // the share sheet was dismissed, or the clipboard is blocked: not an error
    }
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => void invite()}
        className="w-full rounded-full border border-line px-4 py-3 font-semibold"
      >
        {t('friends.invite')}
      </button>
      <p className="mt-2 text-xs text-muted">{t('friends.inviteHint')}</p>
    </section>
  )
}
