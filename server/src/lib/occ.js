/**
 * Load a document, apply a change, save, and retry when another writer saved first.
 * With optimisticConcurrency on, a stale save throws VersionError instead of overwriting.
 * `load` returns the fresh document (or null: nothing to do), `mutate(doc)` applies the change
 * and may throw to abort. Returns { doc, result } or null when `load` finds nothing.
 */
export async function mutateWithRetry(load, mutate, { maxAttempts = 8 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const doc = await load();
    if (!doc) return null;
    try {
      const result = mutate(doc);
      const saved = await doc.save();
      return { doc: saved, result };
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30 * (attempt + 1)));
    }
  }
  return null;
}
