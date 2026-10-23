import { describe, expect, it } from 'vitest'
import { CREATION_TEMPLATES, creationKindFromQuery, creationTemplate } from '../editor/creationTemplates'
import { SLIDE_TYPES } from '../editor/slideTypes'

describe('creation templates', () => {
  it('offers exactly Quiz, Presentation and Blank, in that order', () => {
    expect(CREATION_TEMPLATES.map((t) => t.kind)).toEqual(['quiz', 'presentation', 'blank'])
  })

  it('every template has a name, a blurb and a name placeholder', () => {
    for (const t of CREATION_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.blurb.length).toBeGreaterThan(10)
      expect(t.namePlaceholder.length).toBeGreaterThan(0)
      expect(creationTemplate(t.kind)).toBe(t)
    }
  })

  it('starter slides are real slide types, and Blank starts empty', () => {
    const types = SLIDE_TYPES.map((t) => t.type)
    for (const t of CREATION_TEMPLATES) {
      if (t.starterSlide) expect(types).toContain(t.starterSlide)
    }
    expect(creationTemplate('blank').starterSlide).toBeNull()
    expect(creationTemplate('quiz').starterSlide).toBe('quiz')
    expect(creationTemplate('presentation').starterSlide).toBe('multiple-choice')
  })

  it('parses the one-time start hint from the route query', () => {
    expect(creationKindFromQuery('quiz')).toBe('quiz')
    expect(creationKindFromQuery('presentation')).toBe('presentation')
    expect(creationKindFromQuery('blank')).toBe('blank')
    expect(creationKindFromQuery(['quiz'])).toBe('quiz')
    expect(creationKindFromQuery('nope')).toBeNull()
    expect(creationKindFromQuery(undefined)).toBeNull()
    expect(creationKindFromQuery(['quiz', 'blank'])).toBe('quiz')
  })
})
