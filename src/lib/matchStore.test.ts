import { beforeEach, describe, expect, it } from 'vitest'
import type { TallyEntry } from '@/types/cards'
import {
  createMatch,
  listMatches,
  loadMatch,
  openMatch,
  saveMatch,
  tallyTotal,
  totalsByLabel,
} from './matchStore'

const entry = (label: string, value: number): TallyEntry => ({
  id: crypto.randomUUID(),
  label,
  value,
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('match persistence', () => {
  it('round-trips a match through local storage', () => {
    const match = createMatch({
      gameSlug: 'brisca',
      playerCount: 4,
      deckSlugs: ['espanola-40'],
      playerNames: ['Ana', 'Luis'],
    })
    const loaded = loadMatch(match.id)
    expect(loaded).not.toBeNull()
    expect(loaded?.gameSlug).toBe('brisca')
    expect(loaded?.playerNames).toEqual(['Ana', 'Luis'])
    expect(loaded?.endedAt).toBeUndefined()
  })

  it('offers only an unfinished match to resume', () => {
    const match = createMatch({
      gameSlug: 'escoba',
      playerCount: 2,
      deckSlugs: [],
      playerNames: [],
    })
    expect(openMatch()?.id).toBe(match.id)

    saveMatch({ ...match, endedAt: new Date().toISOString() })
    expect(openMatch()).toBeUndefined()
    expect(listMatches()).toHaveLength(1)
  })

  it('survives unreadable storage', () => {
    window.localStorage.setItem('cartas.matches', 'not json')
    expect(listMatches()).toEqual([])
    expect(openMatch()).toBeUndefined()
  })

  it('lists newest first', () => {
    saveMatch({
      id: 'a', gameSlug: 'brisca', playerCount: 2, deckSlugs: [], playerNames: [],
      notes: '', tally: [], startedAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    })
    saveMatch({
      id: 'b', gameSlug: 'brisca', playerCount: 2, deckSlugs: [], playerNames: [],
      notes: '', tally: [], startedAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    })
    expect(listMatches().map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('tally', () => {
  it('totals the tape, negatives included', () => {
    expect(tallyTotal([entry('Ana', 23), entry('Ana', -8)])).toBe(15)
    expect(tallyTotal([])).toBe(0)
  })

  it('groups per player in insertion order', () => {
    const tape = [entry('Ana', 10), entry('Luis', 5), entry('Ana', -3)]
    expect(totalsByLabel(tape)).toEqual([
      ['Ana', 7],
      ['Luis', 5],
    ])
  })
})
