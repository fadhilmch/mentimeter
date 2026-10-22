import { expect, test } from '@playwright/test'
import { createDeck, joinAudience, poll, presenterAction } from './helpers'

test('a phone that goes offline says so, shows a banner, and recovers', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E offline', [poll('Pick?', ['A', 'B'])])
  await presenterAction(request, deck, { type: 'slide:change', slideIndex: 0 })
  const phone = await joinAudience(browser, deck.code)
  await expect(phone.getByText('Pick?')).toBeVisible()
  await expect(phone.locator('.connection-banner')).toHaveCount(0)
  await phone.screenshot({ path: '/tmp/online.png' })
  await phone.context().setOffline(true)
  await expect(phone.locator('.connection-banner')).toContainText('No connection')
  await phone.screenshot({ path: '/tmp/offline.png' })
  await phone.context().setOffline(false)
  await expect(phone.locator('.connection-banner')).toHaveCount(0, { timeout: 30_000 })
  // Back online: answering works again.
  await phone.locator('.option-button').first().click()
  await expect(phone.locator('.option-button.chosen')).toHaveCount(1)
})
