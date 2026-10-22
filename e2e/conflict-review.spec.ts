import { expect, test } from '@playwright/test'
import { createDeck, poll } from './helpers'

test('a save conflict shows what changed and lets me keep either version', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E conflict', [poll('Original?', ['A', 'B'])])
  const auth = { authorization: `Bearer ${deck.token}` }
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/edit/${deck.id}`)
  const q = page.locator('input[placeholder^="What should we focus"]')
  await expect(q).toHaveValue('Original?')

  // Someone else changes the structure first (another tab or device).
  const current = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  const edited = { title: current.title, theme: current.theme, baseStructureRevision: current.structureRevision,
    slides: [{ ...current.slides[0], question: 'Changed elsewhere?', options: current.slides[0].options.map((o: { id: string; text: string }) => ({ id: o.id, text: o.text })) }] }
  expect((await request.put(`/api/presentations/${deck.id}`, { headers: auth, data: edited })).ok()).toBe(true)

  await q.fill('My edit?')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const panel = page.getByTestId('conflict-panel')
  await expect(panel).toContainText('yours "My edit?", saved "Changed elsewhere?"')
  await page.screenshot({ path: '/tmp/conflict.png' })
  await panel.getByRole('button', { name: /Keep my version/ }).click()
  await expect(page.getByText(/Saved \d/)).toBeVisible()
  const after = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  expect(after.slides[0].question).toBe('My edit?')
  await ctx.close()
})

test('a save conflict shows what changed and using the saved version leaves it intact and keeps my edit as a draft', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E conflict saved', [poll('Original?', ['A', 'B'])])
  const auth = { authorization: `Bearer ${deck.token}` }
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/edit/${deck.id}`)
  const q = page.locator('input[placeholder^="What should we focus"]')
  await expect(q).toHaveValue('Original?')

  // Someone else changes the structure first (another tab or device).
  const current = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  const edited = { title: current.title, theme: current.theme, baseStructureRevision: current.structureRevision,
    slides: [{ ...current.slides[0], question: 'Changed elsewhere?', options: current.slides[0].options.map((o: { id: string; text: string }) => ({ id: o.id, text: o.text })) }] }
  expect((await request.put(`/api/presentations/${deck.id}`, { headers: auth, data: edited })).ok()).toBe(true)

  await q.fill('My edit?')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const panel = page.getByTestId('conflict-panel')
  await expect(panel).toContainText('yours "My edit?", saved "Changed elsewhere?"')
  await page.screenshot({ path: '/tmp/conflict-saved.png' })
  await panel.getByRole('button', { name: /Use the saved version/ }).click()
  await expect(q).toHaveValue('Changed elsewhere?')
  const after = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  expect(after.slides[0].question).toBe('Changed elsewhere?')
  const drafts = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /draft/i.test(k)).map(([, v]) => v).join(' '))
  expect(drafts).toContain('My edit?')
  await ctx.close()
})
