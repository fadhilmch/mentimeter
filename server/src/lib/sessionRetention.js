import { LiveSession } from '../models/liveSession.js';

/**
 * Deletes ended or archived sessions whose end time is older than `days`. Active sessions are never
 * touched. Dry run by default: returns what would go without deleting. Retention is a policy choice
 * the owner has not made, so nothing calls this automatically.
 */
export async function purgeOldSessions({ days, apply = false, now = new Date() }) {
  if (!Number.isFinite(days) || days < 1) throw new RangeError('days must be a number of at least 1');
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const filter = { status: { $in: ['ended', 'archived'] }, endedAt: { $lt: cutoff } };
  const count = await LiveSession.countDocuments(filter);
  if (!apply) return { apply, cutoff, wouldDelete: count, deleted: 0 };
  const res = await LiveSession.deleteMany(filter);
  return { apply, cutoff, wouldDelete: count, deleted: res.deletedCount ?? 0 };
}
