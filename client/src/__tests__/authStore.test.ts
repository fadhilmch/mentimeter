import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// The real Firebase SDK is replaced by a small fake so the store's own decisions are what is tested.
const fb = vi.hoisted(() => {
  const state = {
    currentUser: null as null | { uid: string; email: string; getIdToken: (force?: boolean) => Promise<string> },
    listener: undefined as undefined | ((u: unknown) => Promise<void>),
    deleted: [] as string[],
    deleteFails: false,
    signedOut: 0,
    authStateReady: async () => {},
  }
  const user = (uid: string, email = `${uid}@x.com`) => ({ uid, email, getIdToken: async () => `tok-${uid}` })
  const lib = {
    auth: state as unknown,
    authStateReady: async () => {},
    onIdTokenChanged: (_a: unknown, cb: (u: unknown) => Promise<void>) => { state.listener = cb },
    signInWithEmailAndPassword: async (_a: unknown, email: string) => { state.currentUser = user(email.split('@')[0]); return { user: state.currentUser } },
    createUserWithEmailAndPassword: async (_a: unknown, email: string) => { state.currentUser = user(email.split('@')[0]); return { user: state.currentUser } },
    deleteUser: async (u: { uid: string }) => { if (state.deleteFails) throw new Error('no'); state.deleted.push(u.uid); state.currentUser = null },
    signOut: async () => { state.signedOut++; state.currentUser = null },
    reauthenticateWithCredential: async () => {},
    sendPasswordResetEmail: async () => {},
    EmailAuthProvider: { credential: (e: string, p: string) => ({ e, p }) },
  }
  return { state, user, lib }
})
vi.mock('../firebaseClient', () => ({
  firebaseEnabled: true,
  loadFirebase: async () => fb.lib,
  friendlyAuthError: (e: { code?: string }) => `friendly:${e?.code ?? 'unknown'}`,
}))

// A scripted server: answers are taken in order per "METHOD /path" key. A string 'network' simulates a lost answer.
type Reply = { status: number; body?: unknown } | 'network'
let script: Record<string, Reply[]>
let calls: string[]
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  })
  script = {}; calls = []
  Object.assign(fb.state, { currentUser: null, listener: undefined, deleted: [], deleteFails: false, signedOut: 0 })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`
    calls.push(key)
    const reply = script[key]?.shift()
    if (!reply) throw new Error(`unscripted ${key}`)
    if (reply === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status })
  }))
  setActivePinia(createPinia())
})

const me = 'GET /api/users/me', profile = 'POST /api/users/profile', claim = 'POST /api/users/claim-legacy'
const ok = (name: string, id = '1') => ({ status: 200, body: { user: { id, name, username: null, email: null } } })
const noProfile = { status: 404, body: { code: 'PROFILE_REQUIRED' } }
async function store() { return (await import('../stores/auth')).useAuthStore() }

describe('restoring a session', () => {
  it('drops the previous account when the Firebase login is a different person, then loads the right profile', async () => {
    localStorage.setItem('livepoll.token', 'old'); localStorage.setItem('livepoll.uid', 'alice')
    localStorage.setItem('livepoll.user', JSON.stringify({ id: 'A', name: 'Alice', username: null }))
    fb.state.currentUser = fb.user('bob')
    script[me] = [ok('Bob', 'B')]
    const auth = await store()
    expect(auth.user?.name).toBe('Alice') // before init the stored copy is only a placeholder
    await auth.init()
    expect(auth.user?.name).toBe('Bob')
    expect(auth.uid).toBe('bob')
    expect(auth.token).toBe('tok-bob')
  })

  it('does not show the old profile to a different person when the server cannot be reached', async () => {
    localStorage.setItem('livepoll.token', 'old'); localStorage.setItem('livepoll.uid', 'alice')
    localStorage.setItem('livepoll.user', JSON.stringify({ id: 'A', name: 'Alice', username: null }))
    fb.state.currentUser = fb.user('bob')
    script[me] = ['network']
    const auth = await store()
    await expect(auth.init()).rejects.toBeTruthy()
    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
  })

  it('keeps the saved profile for the same login when offline', async () => {
    localStorage.setItem('livepoll.uid', 'alice'); localStorage.setItem('livepoll.token', 'old')
    localStorage.setItem('livepoll.user', JSON.stringify({ id: 'A', name: 'Alice', username: null }))
    fb.state.currentUser = fb.user('alice')
    script[me] = ['network']
    const auth = await store()
    await auth.init()
    expect(auth.user?.name).toBe('Alice')
  })

  it('a login with no profile is pending, not logged in', async () => {
    fb.state.currentUser = fb.user('carol')
    script[me] = [noProfile]
    const auth = await store()
    await auth.init()
    expect(auth.pendingProfile).toBe(true)
    expect(auth.isLoggedIn).toBe(false)
  })

  it('signing out elsewhere clears the state, and a switch to another login reloads', async () => {
    fb.state.currentUser = fb.user('alice')
    script[me] = [ok('Alice', 'A'), ok('Bob', 'B')]
    const auth = await store()
    await auth.init()
    await fb.state.listener!(null)
    expect(auth.user).toBeNull(); expect(auth.token).toBe('')
    expect(localStorage.getItem('livepoll.user')).toBeNull()
    await fb.state.listener!(fb.user('bob'))
    expect(auth.user?.name).toBe('Bob')
  })
})

describe('login', () => {
  it('does not invent a profile when it is missing', async () => {
    script[me] = [noProfile]
    const auth = await store()
    await auth.loginWithEmail('dave@x.com', 'pw')
    expect(auth.pendingProfile).toBe(true)
    expect(calls).not.toContain(profile)
  })
  it('logout signs out of Firebase and clears everything', async () => {
    script[me] = [ok('Dave')]
    const auth = await store()
    await auth.loginWithEmail('dave@x.com', 'pw')
    await auth.logout()
    expect(fb.state.signedOut).toBe(1); expect(auth.user).toBeNull(); expect(localStorage.getItem('livepoll.token')).toBeNull()
  })
})

describe('signup with an uncertain write', () => {
  it('retries a lost answer, finds the saved profile, and keeps the login', async () => {
    script[profile] = ['network']; script[me] = [ok('Eve')]
    const auth = await store()
    await auth.signupWithEmail('Eve', 'eve@x.com', 'password-1')
    expect(auth.user?.name).toBe('Eve')
    expect(fb.state.deleted).toEqual([])
  })
  it('creates the profile again when the check shows it was not saved', async () => {
    script[profile] = ['network', ok('Eve')]; script[me] = [noProfile]
    const auth = await store()
    await auth.signupWithEmail('Eve', 'eve@x.com', 'password-1')
    expect(auth.user?.name).toBe('Eve')
    expect(fb.state.deleted).toEqual([])
  })
  it('does not delete the login when the outcome stays unknown, and says so', async () => {
    script[profile] = ['network']; script[me] = ['network', 'network']
    const auth = await store()
    await expect(auth.signupWithEmail('Eve', 'eve@x.com', 'password-1')).rejects.toThrow(/could not confirm/)
    expect(fb.state.deleted).toEqual([])
    expect(auth.pendingProfile).toBe(true)
  })
  it('removes the new login only when the server clearly refused', async () => {
    script[profile] = [{ status: 400, body: { message: 'Bad name' } }]; script[me] = [noProfile]
    const auth = await store()
    await expect(auth.signupWithEmail('', 'eve@x.com', 'password-1')).rejects.toThrow('Bad name')
    expect(fb.state.deleted).toEqual(['eve'])
  })
  it('reports it when the cleanup itself fails instead of hiding it', async () => {
    script[profile] = [{ status: 400, body: { message: 'Bad name' } }]; script[me] = [noProfile]
    fb.state.deleteFails = true
    const auth = await store()
    await expect(auth.signupWithEmail('', 'eve@x.com', 'password-1')).rejects.toThrow(/login was created/)
  })
})

describe('a refusal is not proof that nothing was saved', () => {
  it('signup: a duplicate answer while this login already has a profile (two tabs) is a success, never a deletion', async () => {
    script[profile] = [{ status: 409, body: { message: 'An account with this email already exists' } }]; script[me] = [ok('Eve', 'E')]
    const auth = await store()
    await auth.signupWithEmail('Eve', 'eve@x.com', 'password-1')
    expect(auth.user?.id).toBe('E'); expect(fb.state.deleted).toEqual([])
  })
  it('move: first answer lost, the repeat is refused with 409, but the profile exists, so the login stays', async () => {
    script[claim] = ['network', { status: 409, body: { code: 'ALREADY_LINKED' } }]; script[me] = [ok('Old', 'O')]
    const auth = await store()
    await auth.claimLegacyAccount('fb-alice', 'pw', 'alice@x.com', 'password-1')
    expect(auth.user?.id).toBe('O'); expect(fb.state.deleted).toEqual([])
  })
  it('a refusal with an unreachable check keeps the login instead of guessing', async () => {
    script[claim] = [{ status: 409, body: {} }]; script[me] = ['network']
    const auth = await store()
    await expect(auth.claimLegacyAccount('olduser', 'pw', 'old@x.com', 'password-1')).rejects.toThrow(/could not confirm/)
    expect(fb.state.deleted).toEqual([])
  })
})

describe('moving an old account with an uncertain write', () => {
  it('repeats the safe move once after a lost answer and keeps the login', async () => {
    script[claim] = ['network', ok('Old', 'O')]
    const auth = await store()
    await auth.claimLegacyAccount('olduser', 'pw', 'old@x.com', 'password-1')
    expect(auth.user?.id).toBe('O')
    expect(fb.state.deleted).toEqual([])
  })
  it('keeps the login when still unsure', async () => {
    script[claim] = ['network', { status: 503 }]; script[me] = ['network']
    const auth = await store()
    await expect(auth.claimLegacyAccount('olduser', 'pw', 'old@x.com', 'password-1')).rejects.toThrow(/could not confirm/)
    expect(fb.state.deleted).toEqual([])
  })
  it('removes the new login when the old password is clearly wrong', async () => {
    script[claim] = [{ status: 403, body: { message: 'Wrong username or password', code: 'LEGACY_CREDENTIALS' } }]; script[me] = [noProfile]
    const auth = await store()
    await expect(auth.claimLegacyAccount('olduser', 'bad', 'old@x.com', 'password-1')).rejects.toThrow('Wrong username or password')
    expect(fb.state.deleted).toEqual(['old'])
  })
})

describe('finishing setup and deleting', () => {
  it('finishes an interrupted signup with the name given', async () => {
    fb.state.currentUser = fb.user('carol'); script[me] = [noProfile]; script[profile] = [ok('Carol', 'C')]
    const auth = await store()
    await auth.init()
    await auth.finishProfile('Carol')
    expect(auth.isLoggedIn).toBe(true); expect(auth.pendingProfile).toBe(false)
  })
  it('deleting a login that has no profile works and signs out (retry after a partial delete)', async () => {
    fb.state.currentUser = fb.user('carol'); script[me] = [noProfile]; script['DELETE /api/users/me'] = [{ status: 200, body: { ok: true } }]
    const auth = await store()
    await auth.init()
    await auth.deleteAccount('password-1')
    expect(calls).toContain('DELETE /api/users/me'); expect(fb.state.signedOut).toBe(1); expect(auth.pendingProfile).toBe(false)
  })
  it('removes its own login when the server has no service account', async () => {
    fb.state.currentUser = fb.user('carol'); script[me] = [noProfile]; script['DELETE /api/users/me'] = [{ status: 200, body: { ok: true, deletedPresentations: 0, firebaseLoginRemoved: false } }]
    const auth = await store()
    await auth.init()
    await auth.deleteAccount('password-1')
    expect(fb.state.deleted).toEqual(['carol']); expect(fb.state.signedOut).toBe(1)
  })
  it('says plainly when the data is gone but the login could not be removed', async () => {
    fb.state.currentUser = fb.user('carol'); script[me] = [noProfile]; script['DELETE /api/users/me'] = [{ status: 200, body: { ok: true, deletedPresentations: 0, firebaseLoginRemoved: false } }]
    fb.state.deleteFails = true
    const auth = await store()
    await auth.init()
    await expect(auth.deleteAccount('password-1')).rejects.toThrow(/login could not be removed/)
    expect(fb.state.signedOut).toBe(0)
  })
  it('does not delete again when the server already removed the login', async () => {
    fb.state.currentUser = fb.user('carol'); script[me] = [noProfile]; script['DELETE /api/users/me'] = [{ status: 200, body: { ok: true, deletedPresentations: 0, firebaseLoginRemoved: true } }]
    const auth = await store()
    await auth.init()
    await auth.deleteAccount('password-1')
    expect(fb.state.deleted).toEqual([]); expect(fb.state.signedOut).toBe(1)
  })
})
