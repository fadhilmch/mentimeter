import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'networkidle' })
const [popup] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 20000 }),
  p.getByRole('button', { name: 'Continue with Google' }).click(),
])
await popup.waitForLoadState()
// Emulator widget: add a new fake account
await popup.getByText('Add new account').click({ timeout: 20000 })
await popup.locator('#email-input').fill('grace@example.com')
await popup.locator('#display-name-input').fill('Grace Hopper')
await popup.getByRole('button', { name: 'Sign in with Google.com' }).click()
await p.waitForURL('**/finish-setup', { timeout: 20000 }).catch(() => {})
console.log('url after popup:', p.url())
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/shot-finish-setup.png' })
const nameInput = p.locator('input[autocomplete="name"]')
console.log('prefilled name:', await nameInput.inputValue().catch(() => 'n/a'))
await browser.close()
