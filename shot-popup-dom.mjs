import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const p = await ctx.newPage()
await p.goto(base + '/login', { waitUntil: 'networkidle' })
const [popup] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: 'Continue with Google' }).click()])
await popup.waitForLoadState()
await popup.waitForTimeout(1500)
console.log('URL:', popup.url())
const html = await popup.content()
console.log(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\s+/g, ' ').slice(0, 1800))
await popup.screenshot({ path: '/tmp/popup.png' })
await browser.close()
