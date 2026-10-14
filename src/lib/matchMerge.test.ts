import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/cards'
import { planMatchMerge } from './matchMerge'

const match = (id: string, started: string, updated: string, notes = ''): Match => ({
  id,
  gameSlug: 'brisca',
  playerCount: 2,
  deckSlugs: [],
  playerNames: [],
  notes,
  tally: [],
  startedAt: started,
  updatedAt: updated,
})

describe('planMatchMerge', () => {
  it('uploads what only the device has', () => {
    const mine = match('a', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z')
    const plan = planMatchMerge([mine], [])
    expect(plan.toUpload).toEqual([mine])
    expect(plan.toAdopt).toEqual([])
    expect(plan.merged).toEqual([mine])
  })

  it('adopts what only the account has: a second device sees your history', () => {
    const theirs = match('b', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z')
    const plan = planMatchMerge([], [theirs])
    expect(plan.toAdopt).toEqual([theirs])
    expect(plan.toUpload).toEqual([])
  })

  it('keeps the newer copy when both have the same match', () => {
    const older = match('a', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z', 'a medias')
    const newer = match('a', '2026-10-01T10:00:00Z', '2026-10-01T12:00:00Z', 'Ana 11 - Luis 7')

    const localWins = planMatchMerge([newer], [older])
    expect(localWins.merged[0]?.notes).toBe('Ana 11 - Luis 7')
    expect(localWins.toUpload).toEqual([newer])
    expect(localWins.toAdopt).toEqual([])

    const remoteWins = planMatchMerge([older], [newer])
    expect(remoteWins.merged[0]?.notes).toBe('Ana 11 - Luis 7')
    expect(remoteWins.toAdopt).toEqual([newer])
    expect(remoteWins.toUpload).toEqual([])
  })

  it('sends nothing when the two sides already agree', () => {
    const same = match('a', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z')
    const plan = planMatchMerge([same], [{ ...same }])
    expect(plan.toUpload).toEqual([])
    expect(plan.toAdopt).toEqual([])
    expect(plan.merged).toHaveLength(1)
  })

  it('returns the merged history newest first', () => {
    const plan = planMatchMerge(
      [match('a', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z')],
      [match('b', '2026-10-05T10:00:00Z', '2026-10-05T10:00:00Z')],
    )
    expect(plan.merged.map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('is idempotent', () => {
    const local = [match('a', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z')]
    const remote = [match('b', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z')]
    const once = planMatchMerge(local, remote)
    const twice = planMatchMerge(once.merged, once.merged)
    expect(twice.toUpload).toEqual([])
    expect(twice.toAdopt).toEqual([])
    expect(twice.merged).toEqual(once.merged)
  })
})
