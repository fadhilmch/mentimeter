import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACK_TIMEOUT_MS, createSocketTransport, type SocketLike } from '../live/socketTransport'
import type { PresentationState } from '../types'

const state = { title: 'T' } as unknown as PresentationState
const rate = { type: 'rating:cast', slideIndex: 0, value: 2, participantId: 'participant-aaa' } as const

/** A fake socket whose server side the test controls: reply to an emit, or never answer. */
function fakeSocket() {
  const listeners: Record<string, Array<(...a: any[]) => void>> = {}
  const pending: Array<{ event: string; payload: any; cb: (err: Error | null, res?: any) => void; timer: ReturnType<typeof setTimeout> }> = []
  const socket = {
    on: (e: string, fn: (...a: any[]) => void) => { (listeners[e] ??= []).push(fn); return socket },
    off: () => socket,
    disconnect: vi.fn(),
    timeout: (ms: number) => ({
      emit: (event: string, payload: unknown, cb: (err: Error | null, res?: any) => void) => {
        // Like Socket.IO: if no ack arrives within ms, the callback gets a timeout error.
        const timer = setTimeout(() => cb(new Error('operation has timed out')), ms)
        pending.push({ event, payload, cb, timer })
      },
    }),
  } as unknown as SocketLike
  return {
    socket,
    pending,
    reply(res: unknown, index = pending.length - 1) {
      clearTimeout(pending[index].timer)
      pending[index].cb(null, res)
    },
    fire: (e: string, ...a: unknown[]) => listeners[e]?.forEach((fn) => fn(...a)),
  }
}

async function joined(f: ReturnType<typeof fakeSocket>) {
  const t = createSocketTransport(undefined, () => f.socket)
  const p = t.join('123456')
  f.reply({ ok: true, state })
  await p
  return t
}

afterEach(() => vi.useRealTimers())

describe('Socket transport', () => {
  it('joins and sends when the server answers', async () => {
    const f = fakeSocket()
    const t = await joined(f)
    const sent = t.send(rate)
    expect(f.pending.at(-1)?.event).toBe('live:action')
    f.reply({ ok: true })
    await expect(sent).resolves.toBeUndefined()
  })

  it('surfaces a server refusal message', async () => {
    const f = fakeSocket()
    const t = await joined(f)
    const sent = t.send(rate)
    f.reply({ ok: false, message: 'Nope' })
    await expect(sent).rejects.toThrow('Nope')
  })

  it('stops waiting when the server never acknowledges a join', async () => {
    vi.useFakeTimers()
    const f = fakeSocket()
    const t = createSocketTransport(undefined, () => f.socket)
    const p = expect(t.join('123456')).rejects.toThrow('Could not reach the server')
    await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS)
    await p
  })

  it('stops waiting when the server never acknowledges an answer, and says the outcome is unconfirmed', async () => {
    vi.useFakeTimers()
    const f = fakeSocket()
    const t = await joined(f)
    const p = expect(t.send(rate)).rejects.toThrow("couldn't confirm")
    await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS)
    await p
  })

  it('rejoins the room after a reconnect and delivers the fresh snapshot', async () => {
    const f = fakeSocket()
    const t = createSocketTransport(undefined, () => f.socket)
    const seen: unknown[] = []
    t.onState((s) => seen.push(s))
    const j = t.join('123456')
    f.reply({ ok: true, state })
    await j
    f.fire('connect')
    expect(f.pending.at(-1)?.event).toBe('presentation:join')
    expect(f.pending.at(-1)?.payload).toEqual({ accessCode: '123456' })
    f.reply({ ok: true, state: { title: 'after restart' } })
    await Promise.resolve()
    expect(seen).toEqual([{ title: 'after restart' }])
  })

  it('tells the app once a reconnect has rejoined the room, so a stale connection error can be cleared', async () => {
    const f = fakeSocket()
    const t = createSocketTransport(undefined, () => f.socket)
    const recovered = vi.fn()
    t.onReconnect?.(recovered)
    const j = t.join('123456')
    f.reply({ ok: true, state })
    await j
    f.fire('connect')
    expect(recovered).not.toHaveBeenCalled() // not until the server has answered the rejoin
    f.reply({ ok: true, state })
    await Promise.resolve()
    expect(recovered).toHaveBeenCalledTimes(1)
  })

  it('holds an answer made while offline until the rejoin is acknowledged, then sends it', async () => {
    const f = fakeSocket()
    const t = await joined(f)
    f.fire('disconnect')
    const sent = t.send(rate)
    await Promise.resolve()
    expect(f.pending).toHaveLength(1) // nothing emitted while offline (only the first join)
    f.fire('connect')
    expect(f.pending.map((p) => p.event)).toEqual(['presentation:join', 'presentation:join']) // rejoin goes first
    f.reply({ ok: true, state })
    await Promise.resolve()
    await Promise.resolve()
    expect(f.pending.map((p) => p.event)).toEqual(['presentation:join', 'presentation:join', 'live:action'])
    f.reply({ ok: true })
    await expect(sent).resolves.toBeUndefined()
  })

  it('tells the user honestly that an answer made offline was not sent when the connection never returns', async () => {
    vi.useFakeTimers()
    const f = fakeSocket()
    const t = await joined(f)
    f.fire('disconnect')
    const outcome = expect(t.send(rate)).rejects.toThrow('was not sent')
    await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS)
    await outcome
    expect(f.pending).toHaveLength(1)
  })

  it('does not join on the first connect before the user has joined, nor after leaving', async () => {
    const f = fakeSocket()
    const t = createSocketTransport(undefined, () => f.socket)
    f.fire('connect')
    expect(f.pending).toHaveLength(0)
    const j = t.join('123456')
    f.reply({ ok: true, state })
    await j
    t.leave()
    f.fire('connect')
    expect(f.pending).toHaveLength(1)
  })
})

describe('Socket transport connection states', () => {
  it('reports reconnecting on a drop and connected once the room is rejoined', async () => {
    const f = fakeSocket()
    const t = await joined(f)
    const seen: string[] = []
    t.onConnection?.((s) => seen.push(s))
    f.fire('disconnect')
    expect(seen).toEqual(['reconnecting'])
    f.fire('connect')
    f.reply({ ok: true, state })
    await Promise.resolve()
    await Promise.resolve()
    expect(seen).toEqual(['reconnecting', 'connected'])
  })
})
