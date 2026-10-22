import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLiveStore } from '../stores/live'
import type { PresentationState } from '../types'

const snap = (revision: number | undefined, currentSlide = 0) =>
  ({ id: 'x', title: 'T', accessCode: '123456', revision, currentSlide, votingOpen: true, resultsVisible: true, slides: [] }) as unknown as PresentationState

beforeEach(() => setActivePinia(createPinia()))

describe('applyState', () => {
  it('takes newer snapshots and ignores older ones', () => {
    const live = useLiveStore()
    expect(live.applyState(snap(5, 2))).toBe(true)
    expect(live.applyState(snap(4, 1))).toBe(false)
    expect(live.state?.currentSlide).toBe(2)
    expect(live.applyState(snap(6, 3))).toBe(true)
    expect(live.state?.currentSlide).toBe(3)
  })
  it('accepts the same revision (idempotent re-delivery)', () => {
    const live = useLiveStore()
    live.applyState(snap(5, 2))
    expect(live.applyState(snap(5, 2))).toBe(true)
  })
  it('accepts snapshots without a revision (older servers)', () => {
    const live = useLiveStore()
    live.applyState(snap(5, 2))
    expect(live.applyState(snap(undefined, 1))).toBe(true)
  })
})
