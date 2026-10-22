import { describe, expect, it } from 'vitest'
import { deckHasQuiz, shouldAskForName } from '../namePrompt'

const poll = { questionType: 'multiple-choice' }
const quiz = { questionType: 'quiz' }

describe('name prompt', () => {
  it('only decks with a quiz slide count as quiz decks', () => {
    expect(deckHasQuiz([poll, { questionType: 'rating' }])).toBe(false)
    expect(deckHasQuiz([poll, quiz])).toBe(true)
    expect(deckHasQuiz(undefined)).toBe(false)
  })
  it('asks on quiz and mixed decks, never on plain ones', () => {
    expect(shouldAskForName([quiz], '', false)).toBe(true)
    expect(shouldAskForName([poll, quiz], null, false)).toBe(true)
    expect(shouldAskForName([poll], '', false)).toBe(false)
  })
  it('does not ask again once a name is saved or the prompt was dismissed', () => {
    expect(shouldAskForName([quiz], 'Fika Fan', false)).toBe(false)
    expect(shouldAskForName([quiz], '   ', false)).toBe(true)
    expect(shouldAskForName([quiz], '', true)).toBe(false)
  })
})
