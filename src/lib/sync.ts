import { planMerge } from './merge'
import { messagesToUpload, planGroupAdoption } from './groupMerge'
import { pullCollections, pushCollections } from './cloud'
import { createGroup, listGroups, postMessage } from './groups'
import { planMatchMerge } from './matchMerge'
import { pullMatches, pushMatches } from './matchCloud'
import { adoptMatch, listMatches } from './matchStore'
import {
  applyCollections,
  friendGroups,
  groupMessages,
  readCollections,
  subscribe,
} from './prefs'
import { readJson, writeJson } from './store'
import { supabase } from './supabase'

/**
 * Keeps favourites and deck folders in step between this device and the account.
 *
 * The app keeps reading and writing local storage, synchronously, exactly as it
 * does with no account — so every screen stays instant and still works on a
 * train. This engine sits beside it:
 *
 *   on sign-in, first time   pull, union with what is here (see merge.ts), push
 *                            the union, and adopt it locally
 *   on sign-in, after that   pull and adopt: the account is the source of truth,
 *                            which is what makes a second device work
 *   on every local change     push the whole state, debounced
 *
 * Pushing the whole state rather than a diff is what makes removing a favourite
 * stick, and the data is a few rows.
 */

const ADOPTED_KEY = (userId: string) => `cartas.synced.${userId}`
const MATCHES_PUSHED_KEY = (userId: string) => `cartas.matchesPushed.${userId}`
const PUSH_DELAY_MS = 600

let unsubscribe: (() => void) | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let applying = false
let activeUser: string | null = null

/**
 * Observable state, because a sync that quietly fails is worse than one that
 * says so: the person would go on starring things believing they are kept.
 */
export type SyncStatus = 'off' | 'working' | 'saved' | 'error'

export interface SyncState {
  status: SyncStatus
  /** The server's own wording, for the small print — never for the headline. */
  error: string | null
  /**
   * Which half did not go up. The two are separate requests, and saying
   * "favourites could not be saved" when what failed was a match is how
   * somebody ends up looking for a problem in the wrong place.
   */
  failed: 'collections' | 'matches' | 'both' | null
}

let state: SyncState = { status: 'off', error: null, failed: null }
const watchers = new Set<() => void>()

export const syncState = (): SyncState => state

export function subscribeSync(listener: () => void): () => void {
  watchers.add(listener)
  return () => watchers.delete(listener)
}

const reasonText = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason)

function setState(next: SyncState): void {
  state = next
  for (const watcher of watchers) watcher()
}

function schedulePush(userId: string): void {
  if (pushTimer !== null) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    setState({ status: 'working', error: null, failed: null })
    // allSettled, not all: one half failing is not a reason to leave the other
    // half's result unreported, and it is what makes the message truthful
    void Promise.allSettled([
      pushCollections(userId, readCollections()),
      pushChangedMatches(userId),
    ]).then(([collections, matches]) => {
      const broke =
        collections.status === 'rejected' && matches.status === 'rejected'
          ? 'both'
          : collections.status === 'rejected'
            ? 'collections'
            : matches.status === 'rejected'
              ? 'matches'
              : null

      if (broke === null) {
        setState({ status: 'saved', error: null, failed: null })
        return
      }
      const reason =
        collections.status === 'rejected' ? collections.reason : (matches as PromiseRejectedResult).reason
      setState({ status: 'error', error: reasonText(reason), failed: broke })
    })
  }, PUSH_DELAY_MS)
}

export async function startSync(userId: string): Promise<void> {
  if (supabase === null) return
  if (activeUser === userId) return
  stopSync()
  activeUser = userId
  setState({ status: 'working', error: null, failed: null })

  try {
    const remote = await pullCollections(userId)
    const firstTime = !readJson<boolean>(ADOPTED_KEY(userId), false)

    if (firstTime) {
      const plan = planMerge(readCollections(), remote)
      const sendsAnything =
        plan.gamesToUpload.length > 0 ||
        plan.decksToUpload.length > 0 ||
        plan.foldersToCreate.length > 0 ||
        plan.folderDecksToAdd.length > 0

      applying = true
      applyCollections(plan.merged)
      applying = false

      if (sendsAnything) await pushCollections(userId, plan.merged)
      await adoptGroups(userId)
      writeJson(ADOPTED_KEY(userId), true)
    } else {
      applying = true
      applyCollections(remote)
      applying = false
    }

    await syncMatches(userId)
    setState({ status: 'saved', error: null, failed: null })
  } catch (error) {
    // offline, or the account cannot be read: keep what is on the device and let
    // the next local change try again
    applying = false
    setState({ status: 'error', error: reasonText(error), failed: 'both' })
  }

  unsubscribe = subscribe(() => {
    if (applying || activeUser === null) return
    schedulePush(activeUser)
  })
}

/**
 * The history, merged by match id with the newer `updatedAt` winning. Matches
 * are not pushed on every keystroke: only the ones stamped since the last push
 * go up, which keeps writing notes at a table from re-sending a whole history.
 */
async function syncMatches(userId: string): Promise<void> {
  const remote = await pullMatches(userId)
  const plan = planMatchMerge(listMatches(), remote)

  applying = true
  for (const match of plan.toAdopt) adoptMatch(match)
  applying = false

  if (plan.toUpload.length > 0) {
    await pushMatches(userId, plan.toUpload, await accountGroupIds())
  }
  writeJson(MATCHES_PUSHED_KEY(userId), new Date().toISOString())
}

async function accountGroupIds(): Promise<Set<string>> {
  try {
    return new Set((await listGroups()).map((group) => group.id))
  } catch {
    // without the group list, a match syncs without its group rather than not at all
    return new Set()
  }
}

async function pushChangedMatches(userId: string): Promise<void> {
  const since = readJson<string>(MATCHES_PUSHED_KEY(userId), '')
  const changed = listMatches().filter((match) => match.updatedAt > since)
  if (changed.length === 0) return

  await pushMatches(userId, changed, await accountGroupIds())
  writeJson(MATCHES_PUSHED_KEY(userId), new Date().toISOString())
}

export function stopSync(): void {
  setState({ status: 'off', error: null, failed: null })
  unsubscribe?.()
  unsubscribe = null
  if (pushTimer !== null) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  activeUser = null
}

/**
 * Carry the groups made before signing in up to the account, once. The local
 * copies are left where they are rather than deleted: if somebody signs out
 * again, their groups are still on the phone. A group whose name the account
 * already has is skipped, because its members up there may be real accounts and
 * the loose names typed on this phone would be a downgrade.
 */
async function adoptGroups(userId: string): Promise<void> {
  const local = friendGroups()
  if (local.length === 0) return

  const remote = await listGroups()
  const plan = planGroupAdoption(local, remote.map((group) => ({ id: group.id, name: group.name })))

  for (const item of plan.create) {
    const groupId = await createGroup(
      userId,
      item.name,
      item.memberNames.map((displayName) => ({ displayName })),
    )
    for (const body of messagesToUpload(groupMessages(item.localId))) {
      await postMessage(groupId, userId, body)
    }
  }
}
