import { expect, test } from '@playwright/test'
import { createDeck, poll } from './helpers'

test('undo and redo in the editor', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E undo', [poll('First?', ['A', 'B'])])
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/edit/${deck.id}`)
  const questions = page.locator('input[placeholder^="What should we focus"]')
  await expect(questions).toHaveCount(1)

  await page.getByRole('button', { name: /\+ Word cloud/i }).click()
  await expect(questions).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(questions).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(questions).toHaveCount(2)
  await page.screenshot({ path: '/tmp/undo.png' })
  await ctx.close()
})
