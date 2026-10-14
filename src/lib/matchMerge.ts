import type { Match } from '@/types/cards'

/**
 * Which copy of each match to keep when a device and an account both have some.
 *
 * Matches are identified by an id the device generates, so the same match is the
 * same row everywhere and there is nothing to match up by guesswork. When both
 * sides have one, the newer `updatedAt` wins — the notes someone was still
 * typing at the table should not be overwritten by an older copy from a phone
 * that was offline.
 */

export interface MatchMergePlan {
  /** what both sides should hold afterwards */
  merged: Match[]
  /** the ones the account needs: new here, or newer here */
  toUpload: Match[]
  /** the ones this device needs: new up there, or newer up there */
  toAdopt: Match[]
}

export function planMatchMerge(local: Match[], remote: Match[]): MatchMergePlan {
  const remoteById = new Map(remote.map((match) => [match.id, match]))
  const localById = new Map(local.map((match) => [match.id, match]))

  const merged: Match[] = []
  const toUpload: Match[] = []
  const toAdopt: Match[] = []

  for (const mine of local) {
    const theirs = remoteById.get(mine.id)
    if (theirs === undefined) {
      merged.push(mine)
      toUpload.push(mine)
      continue
    }
    if (mine.updatedAt > theirs.updatedAt) {
      merged.push(mine)
      toUpload.push(mine)
    } else if (theirs.updatedAt > mine.updatedAt) {
      merged.push(theirs)
      toAdopt.push(theirs)
    } else {
      merged.push(mine)
    }
  }

  for (const theirs of remote) {
    if (localById.has(theirs.id)) continue
    merged.push(theirs)
    toAdopt.push(theirs)
  }

  merged.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return { merged, toUpload, toAdopt }
}
