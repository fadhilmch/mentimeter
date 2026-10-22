import { expect, test } from '@playwright/test'
import { closeAudiences, createDeck, joinAudience, openEnded, poll, presenterAction, quiz } from './helpers'

test.afterEach(closeAudiences)

test.describe('critical live flows', () => {
  test('a comment upvote lands on the comment that was tapped, even after the list re-sorts', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E upvote', [openEnded('Best idea?')])
    const [a, b, voter] = [await joinAudience(browser, deck.code), await joinAudience(browser, deck.code), await joinAudience(browser, deck.code)]
    for (const [page, text] of [[a, 'Alpha idea'], [b, 'Bravo idea']] as const) {
      await page.locator('textarea').fill(text)
      await page.getByRole('button', { name: 'Send' }).click()
    }
    const bravo = voter.locator('.response-item', { hasText: 'Bravo idea' })
    await expect(bravo).toBeVisible()
    await bravo.locator('.upvote-button').click()
    await expect(voter.locator('.response-item').first()).toContainText('Bravo idea') // re-sorted to the top
    const late = await joinAudience(browser, deck.code)
    await expect(late.locator('.response-item').first()).toContainText('Bravo idea')
    await late.locator('.response-item').first().locator('.upvote-button').click() // the TOP row, not stored position 0
    await expect(late.locator('.response-item').first()).toContainText('▲ 2')
    await expect(late.locator('.response-item').nth(1)).toContainText('▲ 0')
    await late.reload()
    await expect(late.locator('.upvote-button.on')).toHaveCount(1)
    await expect(late.locator('.response-item', { hasText: 'Bravo idea' }).locator('.upvote-button.on')).toHaveCount(1)
  })

  test('presenter slide changes reach the phone, and answers for a slide that left the screen are refused', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E paced', [poll('First?', ['A1', 'A2']), poll('Second?', ['B1', 'B2'])])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const phone = await joinAudience(browser, deck.code)
    await expect(phone.getByText('First?')).toBeVisible()
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 1 })
    await expect(phone.getByText('Second?')).toBeVisible()
    // A late answer for slide 0 is refused at the API and changes nothing.
    const late = await request.post(`/api/live/${deck.code}/action`, { data: { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'late-person-1' } })
    // With #34 the refusal is a recoverable 409 that carries a code and the fresh state.
    expect(late.status()).toBe(409)
    const lateBody = await late.json()
    expect(lateBody.code).toBe('slide_not_active')
    expect(lateBody.state.currentSlide).toBe(1)
    expect(await late.text()).toContain('no longer on screen')
    await phone.locator('.option-button').first().click()
    await expect(phone.locator('.option-button.chosen')).toHaveCount(1)
  })

  test('saving a revealed quiz in the editor keeps it locked and keeps its scores', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E quiz lock', [quiz('Closest planet?', ['Mercury', 'Venus'])])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const phone = await joinAudience(browser, deck.code)
    await phone.getByLabel('Choose your nickname').fill('Fika Fan')
    await phone.getByRole('button', { name: 'Save nickname' }).click()
    await phone.locator('.option-button').first().click()
    await presenterAction(request, deck, { type: 'voting:set', open: false }) // reveals the quiz
    const auth = { authorization: `Bearer ${deck.token}` }
    const before = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
    expect(before.slides[0].revealed).toBe(true)
    // Save the same deck again with only a design change.
    const slide = { ...before.slides[0], design: { accent: '#ff5533' } }
    const save = await request.put(`/api/presentations/${deck.id}`, {
      headers: auth,
      data: { title: before.title, theme: before.theme, baseStructureRevision: before.structureRevision ?? 0, slides: [slide] },
    })
    expect(save.ok(), await save.text()).toBeTruthy()
    const after = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
    expect(after.slides[0].revealed).toBe(true)
    expect(after.slides[0].options[0].votes).toHaveLength(1)
    await presenterAction(request, deck, { type: 'voting:set', open: true })
    const again = await request.post(`/api/live/${deck.code}/action`, { data: { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'someone-else-1' } })
    expect(again.status()).toBe(400) // still locked after reopening voting
  })

  test('a quiz asks for a nickname first, and two players with the same name each see only their own YOU', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E quiz names', [quiz('Closest planet?', ['Mercury', 'Venus', 'Mars'])])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const phones = [await joinAudience(browser, deck.code), await joinAudience(browser, deck.code)]
    for (const [i, phone] of phones.entries()) {
      await expect(phone.getByLabel('Choose your nickname')).toBeVisible()
      await expect(phone.locator('.option-button')).toHaveCount(0) // must choose before answering
      await expect(phone.getByRole('button', { name: 'Save nickname' })).toBeDisabled()
      await phone.getByLabel('Choose your nickname').fill('Fika Fan')
      await phone.getByRole('button', { name: 'Save nickname' }).click()
      await phone.locator('.option-button').nth(i).click()
    }
    await presenterAction(request, deck, { type: 'voting:set', open: false })
    await presenterAction(request, deck, { type: 'results:set', visible: true })
    for (const phone of phones) {
      await expect(phone.locator('.leaderboard-list li')).toHaveCount(2)
      await expect(phone.locator('.you-chip')).toHaveCount(1)
    }
  })

  test('Generate nickname fills a short adjective + animal name with no number', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E generate', [quiz('Closest planet?', ['Mercury', 'Venus'])])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const phone = await joinAudience(browser, deck.code)
    await phone.getByRole('button', { name: /Generate nickname/ }).click()
    const value = await phone.getByLabel('Choose your nickname').inputValue()
    expect(value).toMatch(/^[A-Za-z]+ [A-Za-z]+$/)
  })

  test('the audience page works at 320px without horizontal scrolling', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E narrow', [poll('Narrow?', ['Yes', 'No'])])
    await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
    const phone = await joinAudience(browser, deck.code)
    await phone.setViewportSize({ width: 320, height: 640 })
    await expect(phone.getByText('Narrow?')).toBeVisible()
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
