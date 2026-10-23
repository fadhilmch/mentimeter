import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
for (const [route, name] of [['/login', 'login'], ['/signup', 'signup']]) {
  for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 800, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    await p.goto(base + route, { waitUntil: 'networkidle' })
    await p.getByRole('button', { name: 'Continue with Google' }).waitFor({ timeout: 15000 })
    await p.waitForTimeout(400)
    await p.screenshot({ path: `/tmp/shot-${name}-${tag}.png` })
    await p.close()
    await ctx.close()
  }
}
await browser.close()
console.log('login/signup shots done')
