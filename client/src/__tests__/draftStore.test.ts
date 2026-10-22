import { describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from '../draftStore'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size },
  }
}

describe('draftStore', () => {
  it('round-trips and clears a draft per presentation', () => {
    const s = memory()
    saveDraft('a', 3, { title: 'x' }, s)
    expect(loadDraft<{ title: string }>('a', s)?.data.title).toBe('x')
    expect(loadDraft('b', s)).toBeNull()
    clearDraft('a', s)
    expect(loadDraft('a', s)).toBeNull()
  })
  it('ignores corrupt data and survives a failing store', () => {
    const s = memory()
    s.setItem('crowdflow.draft.a', '{nope')
    expect(loadDraft('a', s)).toBeNull()
    const broken = { ...s, setItem() { throw new Error('full') } } as Storage
    expect(() => saveDraft('a', 1, {}, broken)).not.toThrow()
  })
})
