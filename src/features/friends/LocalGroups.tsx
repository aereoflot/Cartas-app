import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FriendGroup } from '@/lib/prefs'
import { createFriendGroup, deleteFriendGroup, postGroupMessage } from '@/lib/prefs'
import { useFriendGroups, useGroupMessages } from '@/hooks/usePrefs'
import { GroupChat, GroupMatches } from './GroupPieces'
import { SectionTitle } from '@/components/SectionTitle'

/**
 * Groups with no account: names on this device, and a chat that is really a
 * shared scratchpad. Kept because it works on a phone that has never signed in,
 * and because signing in carries these up rather than discarding them.
 */
export function LocalGroups() {
  const { t } = useTranslation()
  const groups = useFriendGroups()
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')

  const addGroup = () => {
    const name = groupName.trim()
    if (name === '') return
    createFriendGroup(
      name,
      groupMembers.split(',').map((m) => m.trim()).filter((m) => m !== ''),
    )
    setGroupName('')
    setGroupMembers('')
  }

  return (
    <section>
      <SectionTitle>{t('groups.title')}</SectionTitle>

      {groups.length === 0 ? (
        <p className="mt-2 rounded-card border border-dashed border-line px-3 py-4 text-sm text-muted">
          {t('groups.empty')}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <LocalGroupCard group={group} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2 rounded-card border border-line bg-surface p-3">
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder={t('groups.name')}
          aria-label={t('groups.name')}
          className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <input
          value={groupMembers}
          onChange={(event) => setGroupMembers(event.target.value)}
          placeholder={t('groups.membersPlaceholder')}
          aria-label={t('groups.members')}
          className="w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        {/* Names today, accounts later: once there are friends, a member is a
            person the chat can actually reach, not a label. */}
        <p className="text-xs text-muted">{t('groups.membersHint')}</p>
        <button
          type="button"
          onClick={addGroup}
          className="w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink"
        >
          {t('groups.create')}
        </button>
      </div>
    </section>
  )
}

function LocalGroupCard({ group }: { group: FriendGroup }) {
  const { t } = useTranslation()
  const messages = useGroupMessages(group.id)

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{group.name}</h3>
        <button
          type="button"
          onClick={() => deleteFriendGroup(group.id)}
          aria-label={t('groups.delete', { name: group.name })}
          className="text-xs font-medium text-danger"
        >
          {t('groups.deleteShort')}
        </button>
      </div>

      {group.members.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {group.members.map((member) => (
            <span
              key={member}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs"
            >
              {member}
            </span>
          ))}
        </div>
      )}

      <GroupMatches groupId={group.id} memberNames={group.members} />

      <GroupChat
        lines={messages.map((message) => ({
          id: message.id,
          who: message.author,
          body: message.body,
          at: message.at,
        }))}
        note={t('groups.chatLocal')}
        onSend={(body) => postGroupMessage(group.id, t('groups.me'), body)}
      />
    </div>
  )
}
