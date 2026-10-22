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

const tokenKey = (code: string) => `livepoll.token.${code}`;

/** The credential for one presentation, or null when the server has not issued one yet. */
export function participantToken(code: string): string | null {
  return localStorage.getItem(tokenKey(code));
}

/**
 * Asks the server for a credential scoped to this presentation, so the server can verify who is
 * answering. It proves "same browser as before", not "one unique human". Never fatal: if the
 * request fails, answers still work through the older id-only path while the server allows it.
 */
export async function ensureCredential(code: string, doFetch: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  try {
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    const res = await doFetch(`${base}/api/live/${code}/credential`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: participantId(), token: participantToken(code) ?? undefined }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { participantId: string; token: string };
    // The server decides the id when the old token was valid; keep ours otherwise.
    if (body.participantId && body.participantId !== participantId()) localStorage.setItem(KEY, body.participantId);
    localStorage.setItem(tokenKey(code), body.token);
  } catch {
    /* offline or older server: continue without a credential */
  }
}
