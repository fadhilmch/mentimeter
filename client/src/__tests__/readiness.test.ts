import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, setUnauthorizedHandler } from '../api'
import { slideStepForKey } from '../presenterKeys'

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

  it('self-hosts the app font instead of loading a font CDN', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(readFileSync(join(ROOT, 'public/fonts/OFL.txt'), 'utf8')).toContain('SIL Open Font License')
    expect(readFileSync(join(ROOT, 'src/assets/main.css'), 'utf8')).toContain('/fonts/PlusJakartaSans-latin.woff2')
  })

  it('ships share tags and robots.txt', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).toContain('property="og:title"')
    expect(readFileSync(join(ROOT, 'public/robots.txt'), 'utf8')).toContain('User-agent')
  })
})

describe('presenter keyboard', () => {
  const key = (k: string, target: unknown = { tagName: 'BODY' }, mods = {}) =>
    slideStepForKey({ key: k, altKey: false, ctrlKey: false, metaKey: false, target: target as EventTarget, ...mods })

  it('steps slides with arrows and page keys', () => {
    expect(key('ArrowRight')).toBe(1)
    expect(key('PageDown')).toBe(1)
    expect(key('ArrowLeft')).toBe(-1)
    expect(key('PageUp')).toBe(-1)
  })

  it('ignores typing fields, browser shortcuts and other keys', () => {
    expect(key('ArrowRight', { tagName: 'INPUT' })).toBeNull()
    expect(key('ArrowLeft', { tagName: 'TEXTAREA' })).toBeNull()
    expect(key('ArrowLeft', { tagName: 'BODY' }, { altKey: true })).toBeNull()
    expect(key('a')).toBeNull()
  })
})

describe('deleted presentation detection', () => {
  it('recognises the errors the server sends when a presentation is gone', async () => {
    const { isPresentationGone } = await import('../live/errors')
    expect(isPresentationGone('Presentation is gone')).toBe(true)
    expect(isPresentationGone('No presentation with that code')).toBe(true)
    expect(isPresentationGone('Vote failed.')).toBe(false)
  })
})
