/**
 * Small fixed-window rate limiter used by both live transports (HTTP and Socket.IO), so the
 * same rule applies whichever way an answer arrives.
 *
 * Counters live in memory, so they are per server instance. On a single self-hosted server that
 * is exact. On serverless each warm instance counts separately: limits are then a best-effort
 * brake against a runaway client, not a hard global cap. A shared store (Redis, Mongo) can be
 * dropped in behind `hit()` later without changing callers.
 */
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const buckets = new Map();
  let lastSweep = now();

  function sweep(t) {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [key, b] of buckets) if (b.resetAt <= t) buckets.delete(key);
  }

  return {
    /** Counts one hit. Returns { ok, retryAfterSeconds }. */
    hit(key) {
      const t = now();
      sweep(t);
      let b = buckets.get(key);
      if (!b || b.resetAt <= t) {
        b = { count: 0, resetAt: t + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count > limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) };
      return { ok: true, retryAfterSeconds: 0 };
    },
    reset() {
      buckets.clear();
    },
  };
}
