import { expect, test } from '@playwright/test'
import { closeAudiences, createDeck, joinAudience, openEnded } from './helpers'

test.skip(process.env.E2E_SESSIONS !== 'true', 'needs the server started with SESSIONS_ENABLED=true (E2E_SESSIONS=true)')
test.afterEach(closeAudiences)

test('moderation works on a session run: held text stays hidden, approve shows it', async ({ browser, request }) => {
  const deck = await createDeck(request, 'E2E session moderation', [openEnded('Any thoughts?')])
  const auth = { authorization: `Bearer ${deck.token}` }
  await request.post(`/api/presentations/${deck.id}/moderation/mode`, { data: { mode: 'approve' }, headers: auth })

  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } })
  await ctx.addInitScript((token) => { localStorage.setItem('livepoll.token', token); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'e2e', username: 'e2e' })) }, deck.token)
  const presenter = await ctx.newPage()
  await presenter.goto('/dashboard')
  await presenter.locator('.card', { hasText: 'E2E session moderation' }).getByRole('button', { name: 'Start new session' }).click()
  await presenter.waitForURL(/\/present\/(\d+)/)
  const code = presenter.url().match(/\/present\/(\d+)/)![1]
  expect(code).not.toBe(deck.code)

  const sender = await joinAudience(browser, code)
  const watcher = await joinAudience(browser, code)
  await sender.locator('textarea').fill('Held run thought')
  await sender.getByRole('button', { name: 'Send' }).click()

  await presenter.getByRole('button', { name: /Moderation/ }).click()
  await expect(presenter.locator('.mod-list li', { hasText: 'Held run thought' })).toBeVisible()
  await expect(watcher.getByText('Held run thought')).toHaveCount(0)
  await expect(presenter.locator('.response-item')).toHaveCount(0)
  await presenter.screenshot({ path: '/tmp/session-mod-held.png' })

  await presenter.getByRole('button', { name: 'Approve' }).click()
  await expect(watcher.getByText('Held run thought')).toBeVisible()
  await expect(presenter.locator('.response-item', { hasText: 'Held run thought' })).toBeVisible()
  await presenter.screenshot({ path: '/tmp/session-mod-approved.png' })
  await ctx.close()
})
