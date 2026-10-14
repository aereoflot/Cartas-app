import { describe, expect, it } from 'vitest'
import { fold, matchesQuery } from './search'

describe('fold', () => {
  it('strips accents, case and punctuation', () => {
    expect(fold('Póker Texas hold’em')).toBe('poker texas hold em')
    expect(fold('Chinchón')).toBe('chinchon')
    expect(fold('  ¡Mus!  ')).toBe('mus')
  })

  it('folds ñ, so a keyboard without one still works', () => {
    expect(fold('Niño')).toBe('nino')
  })
})

describe('matchesQuery', () => {
  it('finds a game typed without its accent', () => {
    expect(matchesQuery('Póker Texas hold’em', 'poker')).toBe(true)
    expect(matchesQuery('Chinchón', 'chinchon')).toBe(true)
    expect(matchesQuery('Brisca', 'BRISCA')).toBe(true)
  })

  it('works the other way round: accents typed, plain text stored', () => {
    expect(matchesQuery('Poker', 'póker')).toBe(true)
  })

  it('ignores word order and punctuation', () => {
    expect(matchesQuery('Póker Texas hold’em', 'texas poker')).toBe(true)
    expect(matchesQuery('Póker Texas hold’em', "hold'em")).toBe(true)
    // the apostrophe is in the name, not in anybody's memory of it
    expect(matchesQuery('Póker Texas hold’em', 'holdem')).toBe(true)
  })

  it('forgives one typo in a long enough word', () => {
    expect(matchesQuery('Chinchón', 'chinchn')).toBe(true)
    expect(matchesQuery('Póker', 'pokre')).toBe(true)
    expect(matchesQuery('Solitario (Klondike)', 'solitarip')).toBe(true)
  })

  it('does not forgive two, or a typo in a short word', () => {
    expect(matchesQuery('Chinchón', 'chnchn')).toBe(false)
    expect(matchesQuery('Mus', 'bus')).toBe(false)
  })

  it('still says no to something that is simply not there', () => {
    expect(matchesQuery('Brisca · baza y triunfo', 'parchis')).toBe(false)
  })

  it('matches everything while nothing is typed', () => {
    expect(matchesQuery('Brisca', '')).toBe(true)
    expect(matchesQuery('Brisca', '   ')).toBe(true)
  })

  it('searches the whole haystack, not just the title', () => {
    expect(matchesQuery('Brisca baza y triunfo de la baraja española', 'espanola')).toBe(true)
  })
})
