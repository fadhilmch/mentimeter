import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLiveStore } from '../stores/live'

describe('connection status', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('is connected by default, follows the transport, and the browser being offline wins', () => {
    const live = useLiveStore()
    expect(live.connectionStatus).toBe('connected')
    live.connection = 'reconnecting'
    expect(live.connectionStatus).toBe('reconnecting')
    live.setBrowserOnline(false)
    expect(live.connectionStatus).toBe('offline')
    live.setBrowserOnline(true)
    expect(live.connectionStatus).toBe('reconnecting')
  })
})
