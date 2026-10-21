/** Maps a keydown to a slide step (+1 next, -1 previous) or null when it is not slide navigation. */
export function slideStepForKey(e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'target'>): 1 | -1 | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  const el = e.target as HTMLElement | null
  const tag = el?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return null
  if (e.key === 'ArrowRight' || e.key === 'PageDown') return 1
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') return -1
  return null
}
