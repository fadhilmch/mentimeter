import { expect, test } from '@playwright/test'
import { createDeck, joinAudience, poll, presenterAction } from './helpers'


test('owner report shows live votes', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E report', [poll('Pick one', ['Alpha', 'Beta'])])
  await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
  const voter = await joinAudience(browser, deck.code)
  await voter.getByRole('button', { name: /Beta/ }).click()

  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/report/${deck.id}`)
  const row = page.locator('tr', { hasText: 'Beta' })
  await expect(async () => {
    await page.reload()
    await expect(row).toContainText('100%', { timeout: 2000 })
  }).toPass({ timeout: 15000 })
  await page.screenshot({ path: '/tmp/report.png' })
  await ctx.close()
  await voter.context().close()
})
