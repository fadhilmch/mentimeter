import { expect, test } from '@playwright/test'
import { createDeck, joinAudience, openEnded, poll, presenterAction } from './helpers'

const option = (text: string) => ({ id: crypto.randomUUID(), text })

test.describe('a complete session across question types', () => {
  test('two phones answer a poll, word cloud, rating, ranking and comment; refresh keeps answers; closing voting locks them', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E all types', [
      poll('Poll?', ['Yes', 'No']),
      { questionType: 'word-cloud', question: 'One word?', options: [] },
      { questionType: 'rating', question: 'Rate it', options: [] },
      { questionType: 'ranking', question: 'Rank these', options: ['First', 'Second', 'Third'].map(option) },
      openEnded('Comment?'),
    ])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const a = await joinAudience(browser, deck.code)
    const b = await joinAudience(browser, deck.code)

    // Poll
    await a.locator('.option-button').nth(0).click()
    await b.locator('.option-button').nth(1).click()
    await expect(a.locator('.option-button.chosen')).toHaveCount(1)

    // Word cloud
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 1 })
    for (const [page, word] of [[a, 'sunny'], [b, 'rainy']] as const) {
      await expect(page.getByText('One word?')).toBeVisible()
      await page.getByPlaceholder('Type a single word…').fill(word)
      await page.getByRole('button', { name: 'Send' }).click()
    }
    await expect(a.getByText('rainy')).toBeVisible()

    // Rating
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 2 })
    await expect(a.getByText('Rate it')).toBeVisible()
    await a.getByRole('radio', { name: '8' }).click()
    await b.getByRole('radio', { name: '6' }).click()
    await expect(a.getByText('Room average: 7')).toBeVisible()

    // Ranking: all three options placed, then sent
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 3 })
    await expect(a.getByText('Rank these')).toBeVisible()
    for (const text of ['Third', 'First', 'Second']) await a.locator('.option-button', { hasText: text }).click()
    await a.getByRole('button', { name: 'Send ranking' }).click()
    await expect(a.getByText(/Ranking sent/)).toBeVisible()

    // Comment, then a refresh keeps what each phone already answered
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 4 })
    await a.locator('textarea').fill('Looks good')
    await a.getByRole('button', { name: 'Send' }).click()
    await expect(b.getByText('Looks good')).toBeVisible()
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 2 })
    await a.reload()
    await expect(a.getByText('You rated 8 of 10')).toBeVisible()

    // Closing voting locks the current question for everyone and says so
    await presenterAction(request, deck, { type: 'voting:set', open: false })
    await expect(a.getByText(/Voting is closed/)).toBeVisible()
    await expect(a.getByRole('radio', { name: '9' })).toBeDisabled()
    const late = await request.post(`/api/live/${deck.code}/action`, { data: { type: 'rating:cast', slideIndex: 2, value: 1, participantId: 'late-comer-1' } })
    expect(late.status()).toBe(400)
  })
})
