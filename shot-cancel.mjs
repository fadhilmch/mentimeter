import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'networkidle' })
const [popup] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: 'Continue with Google' }).click()])
await popup.waitForLoadState()
await popup.close()
await p.waitForTimeout(3000)
console.log('after close: url =', p.url(), '| banner =', await p.locator('.error-banner').textContent().catch(() => 'none'))
await browser.close()
