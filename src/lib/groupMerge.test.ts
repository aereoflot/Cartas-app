import { describe, expect, it } from 'vitest'
import type { FriendGroup, GroupMessage } from './prefs'
import { messagesToUpload, planGroupAdoption } from './groupMerge'

const group = (id: string, name: string, members: string[] = []): FriendGroup =>
  ({ id, name, members })

describe('planGroupAdoption', () => {
  it('uploads the groups made before signing in', () => {
    const plan = planGroupAdoption(
      [group('l1', 'Los del bar', ['Sergio', 'Emilio'])],
      [],
    )
    expect(plan.create).toEqual([
      { name: 'Los del bar', memberNames: ['Sergio', 'Emilio'], localId: 'l1' },
    ])
    expect(plan.skipped).toEqual([])
  })

  it('leaves a group the account already has alone', () => {
    // its members up there may be real accounts; loose names would be a downgrade
    const plan = planGroupAdoption(
      [group('l1', 'Los del bar', ['Sergio'])],
      [{ id: 'r1', name: 'Los del bar' }],
    )
    expect(plan.create).toEqual([])
    expect(plan.skipped).toEqual(['Los del bar'])
  })

  it('matches names regardless of capitals', () => {
    const plan = planGroupAdoption(
      [group('l1', 'los del BAR')],
      [{ id: 'r1', name: 'Los del bar' }],
    )
    expect(plan.create).toEqual([])
    expect(plan.skipped).toEqual(['los del BAR'])
  })

  it('handles a group with no members', () => {
    const plan = planGroupAdoption([group('l1', 'Familia')], [])
    expect(plan.create).toEqual([{ name: 'Familia', memberNames: [], localId: 'l1' }])
  })

  it('is idempotent once uploaded', () => {
    const local = [group('l1', 'Familia', ['Ana'])]
    const first = planGroupAdoption(local, [])
    const after = first.create.map((c, i) => ({ id: `r${i}`, name: c.name }))
    expect(planGroupAdoption(local, after).create).toEqual([])
  })
})

describe('messagesToUpload', () => {
  const message = (id: string, body: string, at: string): GroupMessage =>
    ({ id, author: 'Yo', body, at })

  it('carries the lines up in the order they were written', () => {
    const lines = messagesToUpload([
      message('2', 'segundo', '2026-10-14T11:00:00.000Z'),
      message('1', 'primero', '2026-10-14T10:00:00.000Z'),
    ])
    expect(lines).toEqual(['primero', 'segundo'])
  })

  it('drops blank lines', () => {
    expect(messagesToUpload([message('1', '   ', '2026-10-14T10:00:00.000Z')])).toEqual([])
  })
})
