import { expect, test } from '@playwright/test'
import { createDeck, joinAudience, poll } from './helpers'

test('presenter sees how many clients are connected', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E presence', [poll('Pick one', ['A', 'B'])])
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const presenter = await ctx.newPage()
  await presenter.goto(`/present/${deck.code}`)
  const badge = presenter.getByTestId('presence')
  await expect(badge).toHaveText('1 connected')
  const phone = await joinAudience(browser, deck.code)
  await expect(badge).toHaveText('2 connected')
  await presenter.screenshot({ path: '/tmp/presence.png' })
  await phone.context().close()
  await expect(badge).toHaveText('1 connected')
  await ctx.close()
})
