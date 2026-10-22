import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureCredential, participantId, participantToken } from '../participant'

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  })
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })
})

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response)

describe('participant credential', () => {
  it('stores the token for that presentation and sends the existing id', async () => {
    const id = participantId()
    const f = reply({ participantId: id, token: 'tok-1' })
    await ensureCredential('123456', f as unknown as typeof fetch)
    expect(participantToken('123456')).toBe('tok-1')
    expect(participantToken('999999')).toBeNull()
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)
    expect(sent.participantId).toBe(id)
  })

  it('adopts the id the server confirms', async () => {
    participantId()
    await ensureCredential('123456', reply({ participantId: 'p-from-server', token: 't' }) as unknown as typeof fetch)
    expect(participantId()).toBe('p-from-server')
  })

  it('never throws when the server is unreachable or refuses', async () => {
    const down = vi.fn(async () => { throw new Error('offline') })
    await expect(ensureCredential('123456', down as unknown as typeof fetch)).resolves.toBeUndefined()
    await ensureCredential('123456', reply({}, false) as unknown as typeof fetch)
    expect(participantToken('123456')).toBeNull()
  })
})
