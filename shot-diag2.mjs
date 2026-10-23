import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const p = await ctx.newPage()
p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 160)))
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 250)))
await p.goto(base + '/login', { waitUntil: 'networkidle' })
const [popup] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: 'Continue with Google' }).click()])
await popup.waitForLoadState()
await popup.getByText('Add new account').click()
await popup.locator('#email-input').fill('grace3@example.com')
await popup.locator('#display-name-input').fill('Grace Three')
await popup.getByRole('button', { name: 'Sign in with Google.com' }).click()
for (let i = 0; i < 5; i++) {
  await p.waitForTimeout(2000)
  const closed = popup.isClosed()
  const store = await p.evaluate(() => ({ token: !!localStorage.getItem('livepoll.token'), uid: localStorage.getItem('livepoll.uid'), user: localStorage.getItem('livepoll.user') }))
  console.log(`t+${(i + 1) * 2}s popupClosed=${closed} popupUrl=${closed ? '-' : popup.url().slice(0, 90)} mainUrl=${p.url()} store=${JSON.stringify(store)}`)
  if (store.uid || closed) break
}
await browser.close()
