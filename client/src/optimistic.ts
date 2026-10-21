/**
 * Show an answer straight away, then keep it only if the server accepted it.
 * On failure the previous value (or its absence) is restored and the error is rethrown.
 */
export async function setThenSave<K extends string | number, V>(
  store: Record<K, V>,
  key: K,
  next: V,
  save: () => Promise<unknown>,
): Promise<void> {
  const had = Object.prototype.hasOwnProperty.call(store, key)
  const previous = store[key]
  store[key] = next
  try {
    await save()
  } catch (err) {
    if (had) store[key] = previous
    else delete store[key]
    throw err
  }
}
