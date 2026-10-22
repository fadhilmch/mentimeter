import { expect, test } from '@playwright/test'
import { closeAudiences, createDeck, joinAudience, openEnded } from './helpers'

test.afterEach(closeAudiences)

test.describe('presenter moderation', () => {
  test('held responses stay off the audience screen until approved', async ({ browser, request }) => {
    const deck = await createDeck(request, 'E2E moderation', [openEnded('Any thoughts?')])
    const auth = { authorization: `Bearer ${deck.token}` }
    await request.post(`/api/presentations/${deck.id}/moderation/mode`, { data: { mode: 'approve' }, headers: auth })

    const presenterCtx = await browser.newContext({ viewport: { width: 390, height: 800 } })
    await presenterCtx.addInitScript((token) => localStorage.setItem('livepoll.token', token), deck.token)
    const presenter = await presenterCtx.newPage()
    await presenter.goto(`/present/${deck.code}`)

    const sender = await joinAudience(browser, deck.code)
    const watcher = await joinAudience(browser, deck.code)
    await sender.locator('textarea').fill('Held thought')
    await sender.getByRole('button', { name: 'Send' }).click()

    await presenter.getByRole('button', { name: /Moderation/ }).click()
    await expect(presenter.locator('.mod-list li', { hasText: 'Held thought' })).toBeVisible()
    await expect(watcher.getByText('Held thought')).toHaveCount(0)
    await expect(presenter.locator('.response-item')).toHaveCount(0)

    await presenter.screenshot({ path: '/tmp/mod-held.png' })
    await presenter.getByRole('button', { name: 'Approve' }).click()
    await expect(watcher.getByText('Held thought')).toBeVisible()
    await expect(presenter.locator('.response-item', { hasText: 'Held thought' })).toBeVisible()

    const doc = await (await request.get(`/api/presentations/${deck.id}/moderation`, { headers: auth })).json()
    expect(doc.data.items).toHaveLength(0) // approved items leave the queue
  })
})
