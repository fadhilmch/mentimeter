const KEY = 'livepoll.participantId';

/** Stable anonymous identity for one-vote-per-person and upvote dedup. */
export function participantId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `p-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
