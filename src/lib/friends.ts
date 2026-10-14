import { supabase } from './supabase'

/**
 * Friends by name, not by email.
 *
 * Searching goes through the `search_profiles` function rather than a table
 * query: it decides what a search may return (no email, never yourself, nothing
 * under two characters) in one place, in the database, where the client cannot
 * talk it round.
 */

export type FriendLink = 'none' | 'outgoing' | 'incoming' | 'friends' | 'blocked'

export interface FoundPerson {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  link: FriendLink
}

interface PersonRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  link: FriendLink
}

const toPerson = (row: PersonRow): FoundPerson => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  link: row.link,
})

export async function searchPeople(query: string): Promise<FoundPerson[]> {
  if (supabase === null || query.trim().length < 2) return []

  const { data, error } = await supabase.rpc('search_profiles', { q: query.trim() })
  if (error !== null) throw new Error(error.message)
  return (data as PersonRow[]).map(toPerson)
}

export async function listFriends(): Promise<FoundPerson[]> {
  if (supabase === null) return []

  const { data, error } = await supabase.rpc('my_friends')
  if (error !== null) throw new Error(error.message)
  return (data as PersonRow[]).map(toPerson)
}

export async function requestFriend(me: string, them: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: me, addressee_id: them })
  if (error !== null) throw new Error(error.message)
}

/** Accept a request someone sent you. Only the addressee may. */
export async function acceptFriend(me: string, them: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('requester_id', them)
    .eq('addressee_id', me)
  if (error !== null) throw new Error(error.message)
}

/**
 * Turning someone down, or undoing a friendship, both just remove the row — so
 * a declined request can be sent again later, which is kinder than a permanent
 * "no" nobody can see.
 */
export async function removeFriendship(me: string, them: string): Promise<void> {
  if (supabase === null) return
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${me},addressee_id.eq.${them}),` +
        `and(requester_id.eq.${them},addressee_id.eq.${me})`,
    )
  if (error !== null) throw new Error(error.message)
}
