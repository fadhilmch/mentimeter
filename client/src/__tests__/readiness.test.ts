import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, setUnauthorizedHandler } from '../api'

const ROOT = join(__dirname, '..', '..')

describe('expired sessions', () => {
  beforeEach(() => setUnauthorizedHandler(undefined))

  it('notifies the app when a signed-in request gets 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid or expired token' }), { status: 401 })))
    await expect(api.myPresentations('stale')).rejects.toThrow('Invalid or expired token')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not treat a failed login as an expired session', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 })))
    await expect(api.login('a', 'b')).rejects.toThrow('Invalid credentials')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('public page basics', () => {
  it('gives every route a page title', () => {
    const router = readFileSync(join(ROOT, 'src/router.ts'), 'utf8')
    const routes = router.split('\n').filter((l) => l.includes("path: '"))
    expect(routes.length).toBeGreaterThan(5)
    for (const line of routes) expect(line, line).toContain('title:')
  })

  it('ships share tags and robots.txt', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).toContain('property="og:title"')
    expect(readFileSync(join(ROOT, 'public/robots.txt'), 'utf8')).toContain('User-agent')
  })
})
