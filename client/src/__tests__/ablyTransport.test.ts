import { describe, expect, it, vi } from 'vitest'
import { createAblyTransport, type AblyDeps } from '../live/ablyTransport'
import type { PresentationState } from '../types'

const tokenRequest = { keyName: 'k', timestamp: 1, nonce: 'n', mac: 'm' }
const state = { title: 'T' } as unknown as PresentationState

function setup(overrides: { state?: () => Promise<Response> } = {}) {
  const subs: Array<(m: { data: unknown }) => void> = []
  const ons: Record<string, (change: { resumed: boolean }) => void> = {}
  const channel = {
    name: '',
    subscribe: vi.fn(async (_event: string, fn: (m: { data: unknown }) => void) => { subs.push(fn) }),
    unsubscribe: vi.fn(),
    on: vi.fn((event: string, fn: (change: { resumed: boolean }) => void) => { ons[event] = fn }),
  }
  let options: any
  const close = vi.fn()
  class FakeRealtime {
    channels = { get: (name: string) => { channel.name = name; return channel } }
    close = close
    constructor(o: unknown) { options = o }
  }
  const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
  const fetchFn = vi.fn((url: string) => {
    if (url.endsWith('/token')) return json({ tokenRequest })
    if (url.endsWith('/state')) return overrides.state ? overrides.state() : json({ data: state })
    return json({})
  })
  const deps = { Realtime: FakeRealtime, fetch: fetchFn } as unknown as AblyDeps
  return { deps, channel, subs, ons, close, fetchFn, options: () => options }
}

describe('Ably transport', () => {
  it('delivers state to a handler registered before join (the store does this)', async () => {
    const t = setup()
    const transport = createAblyTransport(t.deps)
    const seen: unknown[] = []
    transport.onState((s) => seen.push(s))
    expect(await transport.join('123456')).toEqual(state)
    t.subs[0]({ data: { title: 'next' } })
    expect(seen).toEqual([{ title: 'next' }])
  })

  it('hands the SDK the token request itself, not the { tokenRequest } wrapper', async () => {
    const t = setup()
    await createAblyTransport(t.deps).join('123456')
    const result = await new Promise((resolve) => t.options().authCallback({}, (err: unknown, tr: unknown) => resolve({ err, tr })))
    expect(result).toEqual({ err: null, tr: tokenRequest })
  })

  it('reports a token refresh failure to the SDK instead of throwing', async () => {
    const t = setup()
    await createAblyTransport(t.deps).join('123456')
    t.fetchFn.mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'Presentation not found' }) } as Response))
    const result = await new Promise((resolve) => t.options().authCallback({}, (err: unknown, tr: unknown) => resolve({ err, tr })))
    expect(result).toEqual({ err: 'Presentation not found', tr: null })
  })

  it('closes the connection when the initial state load fails, and the error reaches the caller', async () => {
    const t = setup({ state: () => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'gone' }) } as Response) })
    await expect(createAblyTransport(t.deps).join('123456')).rejects.toThrow('gone')
    expect(t.close).toHaveBeenCalled()
  })

  it('leave stops delivery and closes the client; a later send is refused', async () => {
    const t = setup()
    const transport = createAblyTransport(t.deps)
    const seen: unknown[] = []
    transport.onState((s) => seen.push(s))
    await transport.join('123456')
    transport.leave()
    t.subs[0]({ data: { title: 'late' } })
    expect(seen).toEqual([])
    expect(t.close).toHaveBeenCalledTimes(1)
    await expect(transport.send({ type: 'vote:cast' } as never)).rejects.toThrow('Join a presentation first')
  })

  it('rejoining closes the previous connection', async () => {
    const t = setup()
    const transport = createAblyTransport(t.deps)
    await transport.join('111111')
    await transport.join('222222')
    expect(t.close).toHaveBeenCalledTimes(1)
  })

  it('send posts the action and surfaces the server message on failure', async () => {
    const t = setup()
    const transport = createAblyTransport(t.deps)
    await transport.join('123456')
    t.fetchFn.mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'Voting is closed' }) } as Response))
    await expect(transport.send({ type: 'vote:cast' } as never)).rejects.toThrow('Voting is closed')
  })

  it('reloads the current state when the channel re-attaches without resuming', async () => {
    const t = setup()
    const transport = createAblyTransport(t.deps)
    const seen: unknown[] = []
    transport.onState((s) => seen.push(s))
    await transport.join('123456')
    t.ons.attached({ resumed: false }) // first attach: nothing to recover
    await Promise.resolve()
    expect(seen).toEqual([])
    t.ons.attached({ resumed: true }) // resumed: no gap
    await Promise.resolve()
    expect(seen).toEqual([])
    t.ons.attached({ resumed: false }) // gap: reload
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toEqual([state])
  })

  it('turns a stalled action into an unknown-outcome message and reloads the saved state', async () => {
    const t = setup()
    t.deps.timeoutMs = 20
    const hang = (_url: string, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')))
    })
    const transport = createAblyTransport(t.deps)
    await transport.join('123456')
    const seen: unknown[] = []
    transport.onState((s) => seen.push(s))
    t.fetchFn.mockImplementationOnce(hang as never)
    await expect(transport.send({ type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'person-1' })).rejects.toThrow("couldn't confirm")
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toEqual([state]) // the authoritative state was fetched, so the screen shows what was saved
  })
})

describe('Ably transport connection states', () => {
  it('maps SDK connection states to connected / reconnecting / offline', async () => {
    let onChange: ((c: { current: string }) => void) | undefined
    const t = setup()
    const Base = t.deps.Realtime as unknown as new (o: unknown) => object
    class WithConnection extends Base {
      connection = { on: (fn: (c: { current: string }) => void) => { onChange = fn } }
    }
    const transport = createAblyTransport({ ...t.deps, Realtime: WithConnection as unknown as AblyDeps['Realtime'] })
    const seen: string[] = []
    transport.onConnection?.((s) => seen.push(s))
    await transport.join('123456')
    for (const current of ['connecting', 'connected', 'disconnected', 'suspended', 'closed']) onChange?.({ current })
    expect(seen).toEqual(['reconnecting', 'connected', 'reconnecting', 'offline'])
  })
})
