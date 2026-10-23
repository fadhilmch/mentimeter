import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'networkidle' })
const [popup] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: 'Continue with Google' }).click()])
// wait for the SDK relay iframe to be fully registered before completing the popup
await p.waitForFunction(() => Array.from(document.querySelectorAll('iframe')).length > 0, null, { timeout: 15000 })
await p.waitForTimeout(2500)
await popup.getByText('Add new account').click()
await popup.locator('#email-input').fill('grace5@example.com')
await popup.locator('#display-name-input').fill('Grace Five')
await popup.getByRole('button', { name: 'Sign in with Google.com' }).click()
await p.waitForURL('**/finish-setup', { timeout: 15000 }).catch(() => {})
console.log('url:', p.url())
const store = await p.evaluate(() => ({ uid: localStorage.getItem('livepoll.uid'), user: localStorage.getItem('livepoll.user') }))
console.log('store:', JSON.stringify(store))
if (p.url().includes('finish-setup')) {
  await p.screenshot({ path: '/tmp/shot-finish-setup.png' })
  console.log('prefilled name:', await p.locator('input[autocomplete="name"]').inputValue())
}
await browser.close()
