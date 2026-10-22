import { describe, expect, it } from 'vitest'
import { copySlide } from '../slideCopy'

describe('copySlide', () => {
  const quiz = {
    id: 'slide-1',
    questionType: 'quiz',
    question: 'Capital of Sweden?',
    options: [{ id: 'a', text: 'Oslo' }, { id: 'b', text: 'Stockholm' }],
    correctOptionId: 'b',
    design: { accent: '#112233' },
  }
  let n = 0
  const ids = () => `new-${++n}`

  it('drops the slide id, gives every option a new id and keeps the answer on the same option', () => {
    const copy = copySlide(quiz, ids)
    expect(copy.id).toBeUndefined()
    expect(copy.options.map((o) => o.text)).toEqual(['Oslo', 'Stockholm'])
    expect(copy.options.map((o) => o.id)).toEqual(['new-1', 'new-2'])
    expect(copy.correctOptionId).toBe('new-2')
    expect(copy.options.find((o) => o.id === copy.correctOptionId)?.text).toBe('Stockholm')
  })

  it('keeps the design and does not share objects with the original', () => {
    const copy = copySlide(quiz, ids)
    expect(copy.design).toEqual({ accent: '#112233' })
    expect(copy.design).not.toBe(quiz.design)
    expect(quiz.options[0].id).toBe('a')
    expect(quiz.correctOptionId).toBe('b')
  })

  it('copes with a slide that has no options', () => {
    const copy = copySlide<{ questionType: string; question: string; options: { id?: string; text: string }[]; correctOptionId?: string }>({ questionType: 'rating', question: 'Rate', options: [] }, ids)
    expect(copy.options).toEqual([])
    expect(copy.correctOptionId).toBeUndefined()
  })
})
