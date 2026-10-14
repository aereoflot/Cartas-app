import { supabase } from './supabase'

/**
 * Groups in Postgres: the people you play with, who can be real accounts or
 * just names, and the messages between them.
 *
 * A member is one or the other, never both — the database enforces it (see
 * docs/data-model.md). A friend added as an account is somebody the chat can
 * reach; a name is a placeholder for whoever has not signed up yet.
 */

export interface GroupMember {
  /** row id, needed to remove the member */
  id: string
  profileId: string | null
  /** what to show: the account's display name, or the plain name typed in */
  name: string
  username: string | null
}

export interface Group {
  id: string
  name: string
  ownerId: string
  members: GroupMember[]
}

export interface GroupMessage {
  id: string
  body: string
  at: string
  authorId: string | null
  authorName: string
}

interface MemberRow {
  id: string
  profile_id: string | null
  display_name: string | null
  profile: { id: string; username: string; display_name: string } | null
}

interface GroupRow {
  id: string
  name: string
  owner_id: string
  friend_group_members: MemberRow[]
}

const toMember = (row: MemberRow): GroupMember => ({
  id: row.id,
  profileId: row.profile_id,
  name: row.profile?.display_name ?? row.display_name ?? '',
  username: row.profile?.username ?? null,
})

export async function listGroups(): Promise<Group[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('friend_groups')
    .select(
      'id, name, owner_id, friend_group_members(id, profile_id, display_name,' +
        ' profile:profiles(id, username, display_name))',
    )
    .order('created_at')

  if (error !== null) throw new Error(error.message)
  return (data as unknown as GroupRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    members: row.friend_group_members.map(toMember),
  }))
}

export interface NewMember {
  profileId?: string
  displayName?: string
}

export async function createGroup(
  ownerId: string,
  name: string,
  members: NewMember[],
): Promise<string> {
  if (supabase === null) throw new Error('no backend')

  const { data, error } = await supabase
    .from('friend_groups')
    .insert({ owner_id: ownerId, name })
    .select('id')
    .single()
  if (error !== null) throw new Error(error.message)

  const groupId = (data as { id: string }).id
  if (members.length > 0) await addMembers(groupId, members)
  return groupId
}

export async function addMembers(groupId: string, members: NewMember[]): Promise<void> {
  if (supabase === null || members.length === 0) return

  const rows = members.map((member) =>
    member.profileId !== undefined
      ? { group_id: groupId, profile_id: member.profileId }
      : { group_id: groupId, display_name: member.displayName },
  )
  // a member already in the group is not an error worth showing anybody
  const { error } = await supabase.from('friend_group_members').insert(rows)
  if (error !== null && error.code !== '23505') throw new Error(error.message)
}

export async function removeMember(memberId: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase.from('friend_group_members').delete().eq('id', memberId)
  if (error !== null) throw new Error(error.message)
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase.from('friend_groups').delete().eq('id', groupId)
  if (error !== null) throw new Error(error.message)
}

export async function listMessages(groupId: string): Promise<GroupMessage[]> {
  if (supabase === null) return []

  const { data, error } = await supabase
    .from('group_messages')
    .select('id, body, created_at, author_id, author:profiles(display_name)')
    .eq('group_id', groupId)
    .order('created_at')

  if (error !== null) throw new Error(error.message)

  interface Row {
    id: string
    body: string
    created_at: string
    author_id: string | null
    author: { display_name: string } | null
  }

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    body: row.body,
    at: row.created_at,
    authorId: row.author_id,
    authorName: row.author?.display_name ?? '',
  }))
}

export async function postMessage(
  groupId: string,
  authorId: string,
  body: string,
): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, author_id: authorId, body })
  if (error !== null) throw new Error(error.message)
}
