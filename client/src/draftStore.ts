// Local, per-browser copy of unsaved editor changes. It survives a crash,
// a refresh or a lost connection. It is never sent anywhere.
export interface Draft<T> {
  savedAt: number
  basedOnRevision: number
  data: T
}

const key = (id: string) => `crowdflow.draft.${id}`

export function saveDraft<T>(id: string, basedOnRevision: number, data: T, storage: Storage = localStorage): void {
  try {
    storage.setItem(key(id), JSON.stringify({ savedAt: Date.now(), basedOnRevision, data } satisfies Draft<T>))
  } catch {
    // Storage full or blocked: drafts are best effort.
  }
}

export function loadDraft<T>(id: string, storage: Storage = localStorage): Draft<T> | null {
  try {
    const raw = storage.getItem(key(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Draft<T>
    if (typeof parsed?.savedAt !== 'number' || parsed.data === undefined) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(id: string, storage: Storage = localStorage): void {
  try {
    storage.removeItem(key(id))
  } catch {
    // ignore
  }
}
