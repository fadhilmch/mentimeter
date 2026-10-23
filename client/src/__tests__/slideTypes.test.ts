import { describe, expect, it } from 'vitest'
import { SLIDE_TYPES, hasOptions, typeHint, typeLabel, typeShort } from '../editor/slideTypes'

describe('slide type metadata', () => {
  it('covers all six question types exactly once', () => {
    expect(SLIDE_TYPES.map((t) => t.type).sort()).toEqual(
      ['multiple-choice', 'open-ended', 'quiz', 'ranking', 'rating', 'word-cloud'].sort(),
    )
    expect(new Set(SLIDE_TYPES.map((t) => t.label)).size).toBe(SLIDE_TYPES.length)
  })

  it('every type has a label, a short label and a one-line hint for the sheet', () => {
    for (const t of SLIDE_TYPES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.short.length).toBeGreaterThan(0)
      expect(t.hint.length).toBeGreaterThan(10)
      expect(typeLabel(t.type)).toBe(t.label)
      expect(typeShort(t.type)).toBe(t.short)
      expect(typeHint(t.type)).toBe(t.hint)
    }
  })

  it('only option-based types take options', () => {
    expect(hasOptions('multiple-choice')).toBe(true)
    expect(hasOptions('quiz')).toBe(true)
    expect(hasOptions('ranking')).toBe(true)
    expect(hasOptions('word-cloud')).toBe(false)
    expect(hasOptions('rating')).toBe(false)
    expect(hasOptions('open-ended')).toBe(false)
  })
})
