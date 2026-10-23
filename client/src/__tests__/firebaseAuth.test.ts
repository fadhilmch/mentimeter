import { describe, it, expect, vi, beforeEach } from 'vitest'
import { friendlyAuthError } from '../firebaseClient'
import { api, setTokenRefresher, setUnauthorizedHandler } from '../api'

describe('friendlyAuthError', () => {
  it('turns Firebase codes into plain messages and never leaks raw codes', () => {
    expect(friendlyAuthError({ code: 'auth/invalid-credential' })).toBe('Wrong email or password.')
    expect(friendlyAuthError({ code: 'auth/user-not-found' })).toBe('Wrong email or password.')
    expect(friendlyAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already has an account/)
    expect(friendlyAuthError({ code: 'auth/too-many-requests' })).toMatch(/Wait a few minutes/)
    expect(friendlyAuthError({ code: 'auth/something-new' })).toBe('Something went wrong. Please try again.')
    expect(friendlyAuthError({ code: 'auth/account-exists-with-different-credential' })).toMatch(/different way/)
    expect(friendlyAuthError({ code: 'auth/popup-blocked' })).toMatch(/popup was blocked/)
    expect(friendlyAuthError({ code: 'auth/unauthorized-domain' })).toMatch(/not set up/)
    expect(friendlyAuthError({ code: 'auth/operation-not-allowed' })).toMatch(/not switched on/)
  })
})

describe('api tokens with Firebase', () => {
  beforeEach(() => {
    setTokenRefresher(undefined)
    setUnauthorizedHandler(undefined)
  })

  it('sends the refreshed token, not the stored one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    setTokenRefresher(async () => 'fresh-token')
    await api.myPresentations('stale-token')
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer fresh-token')
  })

  it('falls back to the stored token when refreshing fails, and a 403 does not sign out', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'PROFILE_REQUIRED' }), { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    setTokenRefresher(async () => { throw new Error('offline') })
    await expect(api.myPresentations('stored-token')).rejects.toMatchObject({ status: 403 })
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer stored-token')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
