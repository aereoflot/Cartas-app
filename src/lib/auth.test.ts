import { describe, expect, it } from 'vitest'
import { classifySignInError } from './auth'

/** What Supabase actually answers, kept verbatim so the mapping is honest. */
const real = (message: string, status?: number, code?: string) =>
  ({ message, status, code }) as unknown as Parameters<typeof classifySignInError>[0]

describe('classifySignInError', () => {
  it('reads the email cap as something to wait out', () => {
    expect(classifySignInError(real('email rate limit exceeded', 429))).toBe('rateLimit')
    expect(classifySignInError(real('over_email_send_rate_limit', 429, 'over_email_send_rate_limit')))
      .toBe('rateLimit')
  })

  it('reads the per-address cooldown the same way', () => {
    expect(
      classifySignInError(
        real('For security purposes, you can only request this after 54 seconds.', 429),
      ),
    ).toBe('rateLimit')
  })

  it('separates a bad address from a busy server', () => {
    expect(classifySignInError(real('Unable to validate email address: invalid format', 400)))
      .toBe('invalidEmail')
    expect(classifySignInError(real('Invalid email', 400, 'validation_failed')))
      .toBe('invalidEmail')
  })

  it('knows a dead connection when it sees one', () => {
    expect(classifySignInError(real('Failed to fetch'))).toBe('offline')
  })

  it('keeps anything else as unknown, so the real wording still gets shown', () => {
    expect(classifySignInError(real('Signups not allowed for otp', 422))).toBe('unknown')
  })
})
