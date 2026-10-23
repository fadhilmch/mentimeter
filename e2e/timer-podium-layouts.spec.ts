import { expect, test, type BrowserContext } from '@playwright/test'
import { closeAudiences, createDeck, joinAudience, presenterAction, quiz, type Deck } from './helpers'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

test.afterEach(closeAudiences)

// Optional real photo (E2E_PHOTO=/path/to.jpg) so screenshots show crop and fit with a real picture.
const PHOTO = process.env.E2E_PHOTO && existsSync(process.env.E2E_PHOTO) ? process.env.E2E_PHOTO : ''
const SHOTS = process.env.E2E_SHOTS ?? ''
const shot = async (page: import('@playwright/test').Page, name: string) => { if (SHOTS) await page.waitForTimeout(700); if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }

async function asPresenter(browser: import('@playwright/test').Browser, deck: Deck, viewport = { width: 1280, height: 800 }): Promise<{ ctx: BrowserContext; page: import('@playwright/test').Page }> {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/present/${deck.code}`)
  return { ctx, page }
}

async function setScoring(request: import('@playwright/test').APIRequestContext, deck: Deck, quizScoring: 'speed' | 'standard') {
  const auth = { authorization: `Bearer ${deck.token}` }
  const current = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  const res = await request.put(`/api/presentations/${deck.id}`, { headers: auth, data: { quizScoring, baseStructureRevision: current.structureRevision } })
  expect(res.ok()).toBeTruthy()
}

test.describe('quiz timer, winners podium, layouts and images', () => {
  test('a timed question waits for the presenter, counts down on the phone, then closes', async ({ browser, request }) => {
    const slide = { ...quiz('Fastest planet?', ['Mercury', 'Venus']), timeLimit: 5 }
    const deck = await createDeck(request, 'E2E timer', [slide])
    const phone = await joinAudience(browser, deck.code)
    await phone.getByLabel('Choose your nickname').fill('Quick Quinn')
    await phone.getByRole('button', { name: 'Save nickname' }).click()
    await expect(phone.getByText('Waiting for the presenter to start the timer')).toBeVisible()
    await expect(phone.locator('.option-button').first()).toBeDisabled()
    // The API refuses an answer before the timer starts.
    const early = await request.post(`/api/live/${deck.code}/action`, { data: { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'early-person-1' } })
    expect(early.status()).toBe(400)
    expect(await early.text()).toContain('timer_not_started')
    await presenterAction(request, deck, { type: 'timer:start' })
    await expect(phone.getByTestId('question-timer')).toBeVisible()
    await expect(phone.locator('.option-button').first()).toBeEnabled()
    await phone.locator('.option-button').first().click()
    await expect(phone.locator('.option-button.chosen')).toHaveCount(1)
    await shot(phone, 'phone-timer-running')
    // After the deadline the phone locks and the server refuses late answers.
    await expect(phone.locator('.option-button').first()).toBeDisabled({ timeout: 12_000 })
    await expect(phone.getByText(/Time is up/)).toBeVisible()
    await phone.waitForTimeout(1800) // the server allows 1.5 s of network delay after the deadline
    const late = await request.post(`/api/live/${deck.code}/action`, { data: { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'late-person-1' } })
    expect(late.status()).toBe(400)
    expect(await late.text()).toContain('Time is up')
  })

  test('the presenter screen closes voting by itself when the timer ends', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E auto close', [{ ...quiz('Q?', ['A', 'B']), timeLimit: 5 }])
    const { ctx, page } = await asPresenter(browser, deck)
    await expect(page.getByTestId('start-timer')).toBeVisible()
    await shot(page, 'stage-timer-not-started')
    await page.getByTestId('start-timer').click()
    await expect(page.getByTestId('question-timer')).toBeVisible()
    await shot(page, 'stage-timer-running')
    await expect(page.getByRole('button', { name: 'Reopen voting' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('✓ correct')).toBeVisible()
    await ctx.close()
  })

  test('speed scoring ranks the faster correct player first and the finale shows a podium', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E speed', [{ ...quiz('Capital of Sweden?', ['Stockholm', 'Oslo']), timeLimit: 30 }])
    await setScoring(request, deck, 'speed')
    const fast = await joinAudience(browser, deck.code)
    const slow = await joinAudience(browser, deck.code)
    for (const [page, name] of [[fast, 'Fast Fiona'], [slow, 'Slow Sam']] as const) {
      await page.getByLabel('Choose your nickname').fill(name)
      await page.getByRole('button', { name: 'Save nickname' }).click()
    }
    const { ctx, page: stage } = await asPresenter(browser, deck)
    await stage.getByTestId('start-timer').click()
    await expect(fast.locator('.option-button').first()).toBeEnabled()
    await fast.locator('.option-button').first().click()
    await expect(fast.locator('.option-button.chosen')).toHaveCount(1)
    await slow.waitForTimeout(2500)
    await slow.locator('.option-button').first().click()
    await expect(slow.locator('.option-button.chosen')).toHaveCount(1)
    await stage.getByRole('button', { name: 'Close voting' }).click()
    await expect(stage.locator('.lb-rows li').first()).toContainText('Fast Fiona')
    await expect(stage.locator('.lb-rows li').first()).toContainText(/pts/)
    await shot(stage, 'stage-speed-leaderboard')
    await stage.getByTestId('toggle-finale').click()
    await expect(stage.getByTestId('winners-podium')).toBeVisible()
    await expect(stage.getByTestId('winners-podium')).toContainText('Fast Fiona won!')
    await stage.waitForTimeout(1200) // let the steps finish rising
    await shot(stage, 'stage-podium')
    await expect(fast.getByTestId('winners-podium')).toBeVisible()
    await expect(slow.getByTestId('winners-podium')).toContainText('Slow Sam')
    await expect(slow.getByTestId('winners-podium')).toContainText('Faster correct answers score more')
    await fast.getByTestId('winners-podium').scrollIntoViewIfNeeded()
    await fast.waitForTimeout(1200)
    await shot(fast, 'phone-podium')
    await stage.getByTestId('toggle-finale').click()
    await expect(stage.getByTestId('winners-podium')).toHaveCount(0)
    await ctx.close()
  })

  test('title, columns and image slides show on the stage and phones with nothing to answer', async ({ browser, request }) => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const token = (await (await request.post('/api/users/login', { data: { username: 'demo', password: 'demo1234' } })).json()).token
    const up = await request.post('/api/media', { headers: { authorization: `Bearer ${token}`, 'content-type': PHOTO ? 'image/jpeg' : 'image/png' }, data: PHOTO ? readFileSync(PHOTO) : png })
    expect(up.status()).toBe(201)
    const url = (await up.json()).data.url as string
    const deck = await createDeck(request, 'E2E layouts', [
      { questionType: 'title', question: 'Welcome to the kickoff', body: 'Q4 planning', options: [] },
      { questionType: 'columns', question: 'The plan', columns: [{ title: 'Now', text: 'Ship the timer' }, { title: 'Next', text: 'Learn from the room' }], options: [] },
      { questionType: 'image', question: 'Our team', design: { imageUrl: url }, options: [] },
      { ...quiz('Where was this photo taken?', ['A lake', 'A desert']), design: { imageUrl: url, imageLayout: 'beside' } },
      { ...quiz('Name this place', ['A lake', 'A desert']), design: { imageUrl: url, imageLayout: 'behind' } },
    ])
    const phone = await joinAudience(browser, deck.code)
    const { ctx, page: stage } = await asPresenter(browser, deck)
    await expect(stage.getByTestId('layout-title')).toContainText('Welcome to the kickoff')
    await expect(stage.getByTestId('layout-title')).toContainText('Q4 planning')
    await expect(stage.getByRole('button', { name: 'Close voting' })).toHaveCount(0) // nothing to close on a content slide
    await shot(stage, 'stage-title')
    await expect(phone.getByTestId('layout-title')).toContainText('Welcome to the kickoff')
    await expect(phone.locator('.option-button, textarea')).toHaveCount(0)
    await shot(phone, 'phone-title')
    await stage.getByRole('button', { name: 'Next →' }).click()
    await expect(stage.getByTestId('layout-columns')).toContainText('Ship the timer')
    await expect(phone.getByTestId('layout-columns')).toContainText('Learn from the room')
    await shot(stage, 'stage-columns')
    await shot(phone, 'phone-columns')
    await stage.getByRole('button', { name: 'Next →' }).click()
    await expect(stage.getByTestId('layout-image').locator('img')).toBeVisible()
    await expect.poll(() => stage.getByTestId('layout-image').locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0)
    await expect(phone.getByTestId('layout-image').locator('img')).toBeVisible()
    await shot(stage, 'stage-image')
    await shot(phone, 'phone-image')
    await stage.getByRole('button', { name: 'Next →' }).click()
    await phone.getByLabel('Choose your nickname').fill('Photo Fan')
    await phone.getByRole('button', { name: 'Save nickname' }).click()
    await expect(phone.getByText('Where was this photo taken?')).toBeVisible()
    await shot(stage, 'stage-quiz-beside')
    await shot(phone, 'phone-quiz-beside')
    await stage.getByRole('button', { name: 'Next →' }).click()
    await expect(phone.getByText('Name this place')).toBeVisible()
    await shot(stage, 'stage-quiz-behind')
    await shot(phone, 'phone-quiz-behind')
    await ctx.close()
  })

  test('the editor adds a layout slide, uploads an image and keeps the time limit and scoring', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E editor', [{ ...quiz('Edit me?', ['Yes', 'No']) }])
    const { ctx, page } = await asPresenter(browser, deck)
    await page.goto(`/edit/${deck.id}`)
    await page.getByTestId('time-limit').selectOption('20')
    await page.locator('summary', { hasText: 'Title & theme' }).click()
    await page.getByTestId('quiz-scoring').selectOption('speed')
    await shot(page, 'editor-quiz-time-limit')
    // Add a title slide from the sheet.
    await page.getByRole('button', { name: /Add slide|\+/ }).first().click()
    await page.getByRole('button', { name: /Title slide/ }).click()
    await page.getByLabel('Title', { exact: false }).first().fill('Hello team')
    await shot(page, 'editor-title-slide')
    // Add an image-only slide and upload a real png through the file input.
    await page.getByRole('button', { name: /Add slide|\+/ }).first().click()
    await page.getByRole('button', { name: /Image only/ }).click()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    writeFileSync('/tmp/e2e-pixel.png', png)
    await page.getByLabel('Choose an image file').first().setInputFiles(PHOTO || '/tmp/e2e-pixel.png')
    await expect(page.getByAltText('Selected slide image').first()).toBeVisible()
    await page.getByLabel('Caption').fill('The team')
    await shot(page, 'editor-image-slide')
    await page.getByRole('button', { name: /^Save/ }).first().click()
    await expect.poll(async () => (await (await request.get(`/api/presentations/${deck.id}`, { headers: { authorization: `Bearer ${deck.token}` } })).json()).data.slides.length).toBe(3)
    const saved = (await (await request.get(`/api/presentations/${deck.id}`, { headers: { authorization: `Bearer ${deck.token}` } })).json()).data
    expect(saved.quizScoring).toBe('speed')
    expect(saved.slides[0].timeLimit).toBe(20)
    expect(saved.slides[1]).toMatchObject({ questionType: 'title', question: 'Hello team' })
    expect(saved.slides[2].design.imageUrl).toMatch(/^\/api\/media\/[a-f0-9]{32}$/)
    const first = saved.slides[2].design.imageUrl as string

    // Your uploads: the file in use cannot be deleted; replace it, save, then the old file can go.
    await page.getByTestId('manage-uploads').click()
    await expect(page.getByTestId('upload-quota')).toHaveText(/\d+ of 200 uploads used/)
    const used = Number((await page.getByTestId('upload-quota').textContent())!.match(/^(\d+)/)![1]) // the demo account is shared by other specs
    await expect(page.locator('.iuf-item.current').getByTestId('delete-upload')).toBeDisabled()
    await expect(page.getByTestId('uploads-panel')).toContainText('Selected on this slide')
    await shot(page, 'editor-uploads-panel')
    await page.getByLabel('Choose an image file').first().setInputFiles(PHOTO || '/tmp/e2e-pixel.png')
    await expect(page.getByTestId('upload-quota')).toHaveText(`${used + 1} of 200 uploads used`)
    // The saved deck still shows the first file, so it is protected until the deck is saved.
    await expect(page.locator(`.iuf-item:has(img[src$="${first}"])`).getByTestId('delete-upload')).toBeDisabled()
    await expect(page.locator(`.iuf-item:has(img[src$="${first}"])`)).toContainText('Used in')
    await page.getByRole('button', { name: /^Save/ }).first().click()
    await expect.poll(async () => (await (await request.get(`/api/presentations/${deck.id}`, { headers: { authorization: `Bearer ${deck.token}` } })).json()).data.slides[2].design.imageUrl).not.toBe(first)
    await page.getByTestId('manage-uploads').click()
    await page.getByTestId('manage-uploads').click()
    const old = page.locator(`.iuf-item:has(img[src$="${first}"])`)
    await expect(old.getByTestId('delete-upload')).toBeEnabled()
    await old.getByTestId('delete-upload').click()
    await page.getByTestId('confirm-delete-upload').click()
    await expect(page.getByTestId('upload-quota')).toHaveText(`${used} of 200 uploads used`)
    expect((await request.get(first)).status()).toBe(404)
    await ctx.close()
  })
})
