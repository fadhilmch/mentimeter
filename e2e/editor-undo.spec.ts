import { expect, test } from '@playwright/test'
import { createDeck, poll } from './helpers'

test('undo and redo in the editor', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E undo', [poll('First?', ['A', 'B'])])
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/edit/${deck.id}`)
  const questions = page.locator('input[placeholder^="What should we focus"]')
  await expect(questions).toHaveCount(1) // the sorter edits one slide at a time
  const items = page.getByTestId('sorter-item')
  await expect(items).toHaveCount(1)

  await page.getByRole('button', { name: 'Add slide' }).click()
  await page.getByRole('dialog', { name: 'Add a slide' }).getByRole('button', { name: /Word cloud/ }).click()
  await expect(items).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(items).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(items).toHaveCount(2)
  await page.screenshot({ path: '/tmp/undo.png' })
  await ctx.close()
})

test('the sorter previews every slide and the stage preview follows the selection', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E sorter', [poll('First?', ['A', 'B']), poll('Second?', ['C', 'D'])])
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/edit/${deck.id}`)
  const items = page.getByTestId('sorter-item')
  await expect(items).toHaveCount(2)
  await expect(page.getByText('Stage preview · Slide 1 of 2')).toBeVisible()

  await items.nth(1).click()
  await expect(page.getByText('Stage preview · Slide 2 of 2')).toBeVisible()
  await expect(page.locator('input[placeholder^="What should we focus"]')).toHaveValue('Second?')
  await ctx.close()
})
