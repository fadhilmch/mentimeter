/**
 * Per-key leading+trailing coalescing. The first call runs now. Calls that arrive while it runs,
 * or within `windowMs` after it started, share one trailing run, so a burst of N votes costs a
 * couple of snapshots instead of N. Every caller's promise resolves after a run that started
 * after its call, so a caller never sees state older than its own change.
 * windowMs <= 0 disables coalescing (every call runs).
 */
export function createCoalescer(run, windowMs) {
  if (!(windowMs > 0)) return (key) => run(key);
  const slots = new Map();
  return function coalesced(key) {
    const slot = slots.get(key);
    if (!slot) return start(key);
    if (!slot.trailing) {
      slot.trailing = new Promise((resolve, reject) => {
        slot.running.then(() => wait(slot.startedAt + windowMs)).then(() => resolve(start(key, true)), reject);
      });
    }
    return slot.trailing;
  };

  function start(key, fromTrailing = false) {
    const startedAt = Date.now();
    const slot = { startedAt, trailing: null, running: null };
    slots.set(key, slot);
    slot.running = Promise.resolve()
      .then(() => run(key))
      .finally(() => {
        // Keep the slot while a trailing run is queued; otherwise release the key.
        if (!slot.trailing && slots.get(key) === slot) slots.delete(key);
      });
    if (fromTrailing) slot.running.catch(() => {});
    return slot.running;
  }
}

const wait = (until) => new Promise((resolve) => setTimeout(resolve, Math.max(0, until - Date.now())));
