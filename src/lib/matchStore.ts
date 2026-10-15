import type { Match, TallyEntry } from '@/types/cards'
import { readJson, writeJson } from './store'

/**
 * Matches live in local storage first. The panel is used at a table, offline,
 * mid-game: it must never depend on the network. Syncing these rows up to
 * Postgres (`matches`) is M5's job, with `updated_at` as the tiebreaker.
 */

const INDEX_KEY = 'cartas.matches'
const matchKey = (id: string) => `cartas.match.${id}`

const ids = (): string[] => readJson<string[]>(INDEX_KEY, [])

/**
 * A match as this version expects it, whatever version wrote it.
 *
 * Local storage is the one input here that no type checks. A match written
 * before `updatedAt` existed comes back without it, TypeScript believes the
 * field is there, and the first thing that reads it gets `undefined` — which
 * travelled all the way to Postgres as `null value in column "updated_at" of
 * relation "matches" violates not-null constraint`, and because the push is a
 * `Promise.all`, took favourites and folders down with it.
 *
 * `startedAt` is the honest fallback: a match nobody has touched since it was
 * played changed when it was played. Falling back to `now()` instead would make
 * every old match on this phone look newer than the account's copy and win
 * every conflict.
 */
function normalize(raw: Match | null): Match | null {
  if (raw === null || typeof raw.id !== 'string') return null

  const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : new Date(0).toISOString()
  return {
    ...raw,
    startedAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : startedAt,
    // not-null columns with a default in Postgres: an absent key in a bulk
    // upsert becomes null rather than the default, so none of these may be
    // missing by the time they are sent
    deckSlugs: Array.isArray(raw.deckSlugs) ? raw.deckSlugs : [],
    playerNames: Array.isArray(raw.playerNames) ? raw.playerNames : [],
    tally: Array.isArray(raw.tally) ? raw.tally : [],
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    playerCount:
      typeof raw.playerCount === 'number' && Number.isFinite(raw.playerCount)
        ? raw.playerCount
        : Math.max(1, (Array.isArray(raw.playerNames) ? raw.playerNames.length : 0) || 1),
  }
}

export function loadMatch(id: string): Match | null {
  return normalize(readJson<Match | null>(matchKey(id), null))
}

export function saveMatch(match: Match): void {
  // stamping here, in the one place every write goes through, is what lets the
  // sync engine tell which copy of a match is the newer one
  const stamped: Match = { ...match, updatedAt: new Date().toISOString() }
  writeJson(matchKey(stamped.id), stamped)
  const list = ids()
  if (!list.includes(stamped.id)) {
    writeJson(INDEX_KEY, [stamped.id, ...list].slice(0, 200))
  }
}

/** Write a match exactly as given, timestamp included: used when the account's copy wins. */
export function adoptMatch(match: Match): void {
  writeJson(matchKey(match.id), match)
  const list = ids()
  if (!list.includes(match.id)) {
    writeJson(INDEX_KEY, [match.id, ...list].slice(0, 200))
  }
}

export function listMatches(): Match[] {
  return ids()
    .map(loadMatch)
    .filter((m): m is Match => m !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/** The one unfinished match, if any — what Home offers to resume. */
export function openMatch(): Match | undefined {
  return listMatches().find((m) => m.endedAt === undefined)
}

export function createMatch(input: {
  gameSlug: string
  playerCount: number
  deckSlugs: string[]
  playerNames: string[]
  stake?: string
  groupId?: string
}): Match {
  const match: Match = {
    id: crypto.randomUUID(),
    gameSlug: input.gameSlug,
    playerCount: input.playerCount,
    deckSlugs: input.deckSlugs,
    playerNames: input.playerNames,
    notes: '',
    tally: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(input.stake !== undefined && input.stake !== '' ? { stake: input.stake } : {}),
    ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
  }
  saveMatch(match)
  return match
}

export function tallyTotal(entries: TallyEntry[]): number {
  return entries.reduce((n, e) => n + e.value, 0)
}

export function totalsByLabel(entries: TallyEntry[]): Array<[string, number]> {
  const map = new Map<string, number>()
  for (const e of entries) {
    map.set(e.label, (map.get(e.label) ?? 0) + e.value)
  }
  return [...map.entries()]
}

/**
 * Matches played with a group: by the group it was started with when that is
 * recorded, and otherwise by the members who were at the table — which is all
 * there is to go on for matches started before groups existed.
 */
export function matchesWithGroup(groupId: string, memberNames: string[]): Match[] {
  const lower = memberNames.map((name) => name.toLowerCase())
  const enough = Math.min(2, Math.max(memberNames.length, 1))

  return listMatches().filter((match) => {
    if (match.groupId === groupId) return true
    if (match.groupId !== undefined) return false
    const present = match.playerNames.filter((name) => lower.includes(name.toLowerCase()))
    return present.length >= enough
  })
}
