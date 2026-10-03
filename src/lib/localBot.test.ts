import { describe, expect, it } from 'vitest'
import { business } from '../data/site'
import { localReply } from './localBot'

describe('localReply', () => {
  it('lists water slides when asked about water', () => {
    expect(localReply('Do you have water slides?')).toMatch(/^Our water slides:/)
  })

  it('does not treat "small" as "all"', () => {
    expect(localReply('something small')).not.toMatch(/^Here's everything/)
  })

  it('falls back to the phone number for unknown questions', () => {
    expect(localReply('zzz')).toContain(business.phone)
  })
})
