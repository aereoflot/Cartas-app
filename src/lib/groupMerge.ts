import type { FriendGroup, GroupMessage } from './prefs'

/**
 * What to upload when somebody who made groups without an account signs in.
 *
 * Same promise as favourites: signing in loses nothing. A group whose name the
 * account already has is left alone rather than duplicated — its members may
 * already be real accounts there, and overwriting that with the loose names
 * typed on this phone would be a downgrade.
 */

export interface RemoteGroupSummary {
  id: string
  name: string
}

export interface GroupAdoptionPlan {
  /** groups to create, with their members as plain names */
  create: Array<{ name: string; memberNames: string[]; localId: string }>
  /** local groups that already exist up there, left untouched */
  skipped: string[]
}

export function planGroupAdoption(
  local: FriendGroup[],
  remote: RemoteGroupSummary[],
): GroupAdoptionPlan {
  const taken = new Set(remote.map((group) => group.name.toLowerCase()))

  const create: GroupAdoptionPlan['create'] = []
  const skipped: string[] = []

  for (const group of local) {
    if (taken.has(group.name.toLowerCase())) {
      skipped.push(group.name)
      continue
    }
    create.push({ name: group.name, memberNames: group.members, localId: group.id })
  }

  return { create, skipped }
}

/** Local chat lines worth carrying up: everything, oldest first, as mine. */
export function messagesToUpload(messages: GroupMessage[]): string[] {
  return [...messages]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((message) => message.body.trim())
    .filter((body) => body !== '')
}
