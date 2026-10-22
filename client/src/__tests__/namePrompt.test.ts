import { describe, expect, it } from 'vitest'
import { deckHasQuiz, shouldPromptNow } from '../namePrompt'
import { ADJECTIVES, ANIMALS, randomNickname } from '../alias'

const poll = { questionType: 'multiple-choice' }
const quiz = { questionType: 'quiz' }

describe('nickname prompt', () => {
  it('only decks with a quiz slide count as quiz decks', () => {
    expect(deckHasQuiz([poll, { questionType: 'rating' }])).toBe(false)
    expect(deckHasQuiz([poll, quiz])).toBe(true)
    expect(deckHasQuiz(undefined)).toBe(false)
  })
  it('prompts on a quiz slide, never on polls or plain decks', () => {
    expect(shouldPromptNow([quiz], 0, '')).toBe(true)
    expect(shouldPromptNow([poll, quiz], 0, null)).toBe(false)
    expect(shouldPromptNow([poll, quiz], 1, null)).toBe(true)
    expect(shouldPromptNow([poll], 0, '')).toBe(false)
    expect(shouldPromptNow(undefined, 0, '')).toBe(false)
  })
  it('does not prompt once a nickname is saved (blank does not count)', () => {
    expect(shouldPromptNow([quiz], 0, 'Fika Fan')).toBe(false)
    expect(shouldPromptNow([quiz], 0, '   ')).toBe(true)
  })
})

describe('randomNickname', () => {
  it('is an adjective and an animal with no number', () => {
    for (let i = 0; i < 50; i++) {
      const [adjective, animal, ...rest] = randomNickname().split(' ')
      expect(rest).toHaveLength(0)
      expect(ADJECTIVES).toContain(adjective)
      expect(ANIMALS).toContain(animal)
    }
  })
  it('follows the random source', () => {
    expect(randomNickname(() => 0)).toBe(`${ADJECTIVES[0]} ${ANIMALS[0]}`)
    expect(randomNickname(() => 0.999)).toBe(`${ADJECTIVES[ADJECTIVES.length - 1]} ${ANIMALS[ANIMALS.length - 1]}`)
  })
})
