import { describe, expect, it } from 'vitest'
import { clockOffset, fractionLeft, remainingMs, secondsLeft } from '../quizTimer'

describe('quiz timer', () => {
  it('has no remaining time until the timer starts', () => {
    expect(remainingMs(null, 0)).toBeNull()
    expect(remainingMs(undefined, 0)).toBeNull()
  })

  it('counts down against the server clock, not the device clock', () => {
    // The phone is 5 s fast: server time = device time - 5000.
    const offset = clockOffset(1_000_000, 1_005_000)
    expect(offset).toBe(-5000)
    expect(remainingMs(1_020_000, offset, 1_005_000)).toBe(20_000)
    expect(remainingMs(1_020_000, offset, 1_015_000)).toBe(10_000)
  })

  it('never goes below zero', () => {
    expect(remainingMs(1000, 0, 5000)).toBe(0)
  })

  it('shows whole seconds, rounding up so 0 means time is up', () => {
    expect(secondsLeft(20_000)).toBe(20)
    expect(secondsLeft(19_001)).toBe(20)
    expect(secondsLeft(1)).toBe(1)
    expect(secondsLeft(0)).toBe(0)
  })

  it('reports the share of time left for the progress bar', () => {
    expect(fractionLeft(10_000, 20)).toBe(0.5)
    expect(fractionLeft(30_000, 20)).toBe(1)
    expect(fractionLeft(-5, 20)).toBe(0)
    expect(fractionLeft(1000, 0)).toBe(0)
  })
})
