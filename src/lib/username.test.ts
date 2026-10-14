import { describe, expect, it } from 'vitest'
import { checkUsername, normalizeUsername } from './username'

describe('normalizeUsername', () => {
  it('does what the person probably meant', () => {
    expect(normalizeUsername('  Angel  ')).toBe('angel')
    expect(normalizeUsername('Ana Maria')).toBe('ana_maria')
    expect(normalizeUsername('EL_MEJOR')).toBe('el_mejor')
  })
})

describe('checkUsername', () => {
  it('accepts what the database accepts', () => {
    expect(checkUsername('ancor')).toBeNull()
    expect(checkUsername('el_mejor_del_bar')).toBeNull()
    expect(checkUsername('abc')).toBeNull()
    expect(checkUsername('a'.repeat(24))).toBeNull()
  })

  it('rejects what the database would reject', () => {
    expect(checkUsername('ab')).toBe('too-short')
    expect(checkUsername('a'.repeat(25))).toBe('too-long')
    // accents and ñ are out: the handle has to be typeable on any keyboard
    expect(checkUsername('añcor')).toBe('bad-characters')
    expect(checkUsername('josé')).toBe('bad-characters')
    expect(checkUsername('ancor!')).toBe('bad-characters')
    expect(checkUsername('ancor-ruiz')).toBe('bad-characters')
  })

  it('judges the normalized form, not the raw input', () => {
    expect(checkUsername('  Ancor  ')).toBeNull()
    expect(checkUsername('Ana Maria')).toBeNull()
  })
})
