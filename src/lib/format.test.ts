import { describe, expect, it } from 'vitest'
import { durationRange, formatElapsed, playerRange } from './format'

describe('formatElapsed', () => {
  it('shows m:ss under an hour', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(9_000)).toBe('0:09')
    expect(formatElapsed(61_000)).toBe('1:01')
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('shows h:mm:ss from an hour up', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00')
    expect(formatElapsed(3_600_000 + 61_000)).toBe('1:01:01')
  })

  it('never shows a negative clock', () => {
    expect(formatElapsed(-5_000)).toBe('0:00')
  })
})

describe('ranges', () => {
  it('collapses a single-value player range', () => {
    expect(playerRange(2, 4)).toBe('2–4')
    expect(playerRange(4, 4)).toBe('4')
  })

  it('handles a one-sided duration', () => {
    expect(durationRange(10, 20)).toBe('10–20')
    expect(durationRange(30, 30)).toBe('30')
    expect(durationRange(15, undefined)).toBe('15')
    expect(durationRange(undefined, undefined)).toBeNull()
  })
})
