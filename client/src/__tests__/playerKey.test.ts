import { describe, expect, it } from 'vitest'
import { playerKey } from '../alias'

describe('playerKey', () => {
  // The same vectors are pinned in server/tests/leaderboard.test.js: both sides must agree,
  // or a phone would not find its own leaderboard row.
  it('matches the server vectors', () => {
    expect(playerKey('111111', 'p-1')).toBe('296pve18sa')
    expect(playerKey('111111', 'p-2')).toBe('6pixhw4j56')
    expect(playerKey('222222', 'p-1')).toBe('1ey60bew77n')
  })
  it('differs per player and per room', () => {
    expect(playerKey('111111', 'p-1')).not.toBe(playerKey('111111', 'p-2'))
    expect(playerKey('111111', 'p-1')).not.toBe(playerKey('222222', 'p-1'))
  })
})
