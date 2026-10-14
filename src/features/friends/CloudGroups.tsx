import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Group, NewMember } from '@/lib/groups'
import {
  addMembers,
  createGroup,
  deleteGroup,
  listGroups,
  listMessages,
  postMessage,
  removeMember,
} from '@/lib/groups'
import { listFriends } from '@/lib/friends'
import { Loading, LoadFailed } from '@/components/QueryState'
import { GroupChat, GroupMatches } from './GroupPieces'
import { SectionTitle } from '@/components/SectionTitle'

/**
 * Groups kept on the account. Members can be friends — real accounts, who get
 * the messages — or plain names for whoever has not signed up, which is how a
 * group survives the one cousin who will never make an account.
 */
export function CloudGroups({ myId }: { myId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const groups = useQuery({ queryKey: ['groups'], queryFn: listGroups })
  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends })

  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [extraNames, setExtraNames] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['groups'] })

  const create = useMutation({
    mutationFn: async () => {
      const members: NewMember[] = [
        ...picked.map((profileId) => ({ profileId })),
        ...extraNames
          .split(',')
          .map((raw) => raw.trim())
          .filter((raw) => raw !== '')
          .map((displayName) => ({ displayName })),
      ]
      await createGroup(myId, name.trim(), members)
    },
    onSuccess: () => {
      setName('')
      setPicked([])
      setExtraNames('')
      void refresh()
    },
  })

  const acceptedFriends = (friends.data ?? []).filter((person) => person.link === 'friends')

  if (groups.error !== null) return <LoadFailed error={groups.error} />

  return (
    <section>
      <SectionTitle>{t('groups.title')}</SectionTitle>

      {groups.isPending ? (
        <Loading />
      ) : (groups.data ?? []).length === 0 ? (
        <p className="mt-2 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
          {t('groups.empty')}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {(groups.data ?? []).map((group) => (
            <li key={group.id}>
              <CloudGroupCard group={group} myId={myId} onChange={refresh} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2 rounded-card border border-line bg-surface p-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('groups.name')}
          aria-label={t('groups.name')}
          className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />

        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          {t('groups.pickFriends')}
        </p>
        {acceptedFriends.length === 0 ? (
          <p className="text-xs text-muted">{t('groups.noFriendsYet')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {acceptedFriends.map((person) => {
              const on = picked.includes(person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPicked(
                      on ? picked.filter((id) => id !== person.id) : [...picked, person.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    on
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  {person.displayName}
                </button>
              )
            })}
          </div>
        )}

        <input
          value={extraNames}
          onChange={(event) => setExtraNames(event.target.value)}
          placeholder={t('groups.membersPlaceholder')}
          aria-label={t('groups.extraNames')}
          className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">{t('groups.extraNamesHint')}</p>

        <button
          type="button"
          disabled={name.trim() === '' || create.isPending}
          onClick={() => create.mutate()}
          className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {t('groups.create')}
        </button>
        {create.error !== null && (
          <p role="alert" className="text-sm text-danger">
            {create.error instanceof Error ? create.error.message : String(create.error)}
          </p>
        )}
      </div>
    </section>
  )
}

function CloudGroupCard({
  group,
  myId,
  onChange,
}: {
  group: Group
  myId: string
  onChange: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [addName, setAddName] = useState('')

  const messages = useQuery({
    queryKey: ['group-messages', group.id],
    queryFn: () => listMessages(group.id),
  })

  const isOwner = group.ownerId === myId
  const memberNames = group.members.map((member) => member.name)

  const send = useMutation({
    mutationFn: (body: string) => postMessage(group.id, myId, body),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['group-messages', group.id] }),
  })

  const add = useMutation({
    mutationFn: (displayName: string) => addMembers(group.id, [{ displayName }]),
    onSuccess: () => {
      setAddName('')
      onChange()
    },
  })

  const kick = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: onChange,
  })

  const remove = useMutation({ mutationFn: () => deleteGroup(group.id), onSuccess: onChange })

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{group.name}</h3>
        {isOwner && (
          <button
            type="button"
            onClick={() => remove.mutate()}
            aria-label={t('groups.delete', { name: group.name })}
            className="text-xs font-medium text-danger"
          >
            {t('groups.deleteShort')}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {group.members.map((member) => (
          <span
            key={member.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
              member.profileId !== null
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-surface-2 text-muted'
            }`}
            title={member.profileId !== null ? t('groups.realAccount') : t('groups.justAName')}
          >
            {member.name}
            {member.username !== null && <span className="opacity-70">@{member.username}</span>}
            {isOwner && (
              <button
                type="button"
                onClick={() => kick.mutate(member.id)}
                aria-label={t('groups.removeMember', { name: member.name })}
                className="ml-0.5"
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>

      {isOwner && (
        <div className="mt-2 flex gap-2">
          <input
            value={addName}
            onChange={(event) => setAddName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && addName.trim() !== '') add.mutate(addName.trim())
            }}
            placeholder={t('groups.addName')}
            aria-label={t('groups.addName')}
            className="min-w-0 flex-1 rounded-card border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={addName.trim() === ''}
            onClick={() => add.mutate(addName.trim())}
            className="shrink-0 rounded-card border border-line px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {t('groups.add')}
          </button>
        </div>
      )}

      <GroupMatches groupId={group.id} memberNames={memberNames} />

      {messages.isPending ? (
        <Loading />
      ) : (
        <GroupChat
          lines={(messages.data ?? []).map((message) => ({
            id: message.id,
            who: message.authorId === myId ? t('groups.me') : message.authorName,
            body: message.body,
            at: message.at,
          }))}
          busy={send.isPending}
          onSend={(body) => send.mutate(body)}
        />
      )}
    </div>
  )
}
