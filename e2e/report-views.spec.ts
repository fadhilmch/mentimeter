import { expect, test } from '@playwright/test'
import { createDeck, presenterAction } from './helpers'

test('report shows rating, word cloud and ranking views and CSV downloads', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E report views', [
    { questionType: 'rating', question: 'Rate it', options: [] },
    { questionType: 'word-cloud', question: 'One word?', options: [] },
    { questionType: 'ranking', question: 'Rank', options: ['First', 'Second'].map((text) => ({ id: crypto.randomUUID(), text })) },
  ])
  const auth = { authorization: `Bearer ${deck.token}` }
  const act = (a: Record<string, unknown>) => request.post(`/api/live/${deck.code}/action`, { data: a })
  await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
  await act({ type: 'rating:cast', slideIndex: 0, value: 8, participantId: 'p-rview1' })
  await presenterAction(request, deck, { type: 'slide:change', slideIndex: 1 })
  await act({ type: 'word:submit', slideIndex: 1, text: 'Sunrise', participantId: 'p-rview1' })
  const doc = (await (await request.get(`/api/presentations/${deck.id}`, { headers: auth })).json()).data
  await presenterAction(request, deck, { type: 'slide:change', slideIndex: 2 })
  const ids = doc.slides[2].options.map((o: { id: string }) => o.id).reverse()
  await act({ type: 'ranking:submit', slideIndex: 2, order: ids, participantId: 'p-rview1' })

  const ctx = await browser.newContext({ viewport: { width: 700, height: 1200 }, acceptDownloads: true })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const page = await ctx.newPage()
  await page.goto(`/report/${deck.id}`)
  await expect(page.getByText('1 ratings, average 8')).toBeVisible()
  await expect(page.getByText('Sunrise (1)')).toBeVisible()
  await expect(page.getByText('Second: 2')).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/report-views.png' })
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Results summary/ }).click()])
  expect(download.suggestedFilename()).toMatch(/summary\.csv$/)
  await ctx.close()
})
