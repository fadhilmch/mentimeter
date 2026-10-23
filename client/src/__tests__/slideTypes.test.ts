import { describe, expect, it } from 'vitest'
import { SLIDE_TYPES, hasOptions, isInteractive, typeHint, typeLabel, typeShort } from '../editor/slideTypes'

describe('slide type metadata', () => {
  it('covers every question and layout type exactly once', () => {
    expect(SLIDE_TYPES.map((t) => t.type).sort()).toEqual(
      ['multiple-choice', 'open-ended', 'quiz', 'ranking', 'rating', 'word-cloud', 'title', 'columns', 'image'].sort(),
    )
    expect(new Set(SLIDE_TYPES.map((t) => t.label)).size).toBe(SLIDE_TYPES.length)
  })

  it('layout slides are content only: no options, nothing to answer', () => {
    for (const type of ['title', 'columns', 'image'] as const) {
      expect(isInteractive(type)).toBe(false)
      expect(hasOptions(type)).toBe(false)
    }
    expect(isInteractive('quiz')).toBe(true)
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

  it('names the voting slide "Multiple choice" consistently - never "Poll"', () => {
    const mc = SLIDE_TYPES.find((t) => t.type === 'multiple-choice')!
    expect(mc.label).toBe('Multiple choice')
    expect(mc.short).toBe('Choice')
    for (const t of SLIDE_TYPES) {
      expect(t.label).not.toMatch(/poll/i)
      expect(t.short).not.toMatch(/poll/i)
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
