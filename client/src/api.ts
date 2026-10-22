const base = import.meta.env.VITE_API_URL ?? '';

// Called when the server rejects a stored token (expired, revoked or invalid),
// so the app can end the session instead of leaving the user half signed in.
let onUnauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

// With Firebase sign-in the token is short-lived. This returns the current one (the SDK refreshes
// it when it is about to expire), so a long-open tab does not send an old token.
let tokenRefresher: (() => Promise<string | undefined>) | undefined;
export function setTokenRefresher(fn: (() => Promise<string | undefined>) | undefined) {
  tokenRefresher = fn;
}

async function call<T>(path: string, options: RequestInit = {}, givenToken?: string): Promise<T> {
  const token = givenToken && tokenRefresher ? ((await tokenRefresher().catch(() => undefined)) ?? givenToken) : givenToken;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // The browser only says "Failed to fetch". Say what it means for the person using the app.
    throw new ApiError(0, { message: "Couldn't reach the server. Check your connection and try again." });
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && givenToken) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** Downloads a private CSV as a file: the owner's token goes in a header, never in the URL. */
export async function downloadCsv(token: string, id: string, kind: 'summary' | 'responses' | 'leaderboard'): Promise<void> {
  const fresh = tokenRefresher ? ((await tokenRefresher().catch(() => undefined)) ?? token) : token;
  let res: Response;
  try {
    res = await fetch(`${base}/api/presentations/${id}/export.csv?kind=${kind}`, { headers: { authorization: `Bearer ${fresh}` } });
  } catch {
    throw new ApiError(0, { message: "Couldn't reach the server. Check your connection and try again." });
  }
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${kind}.csv`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export class ApiError extends Error {
  status: number;
  body: { message?: string; code?: string; removedVotes?: number; removedResponses?: number };
  constructor(status: number, body: { message?: string; code?: string; removedVotes?: number; removedResponses?: number }) {
    super(body.message ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

export interface PublicUser { id: string; name: string; username: string | null; email?: string | null }
export interface AuthResponse { token: string; user: PublicUser }

export const api = {
  signup: (name: string, username: string, password: string) =>
    call<AuthResponse>('/api/users/signup', { method: 'POST', body: JSON.stringify({ name, username, password }) }),
  login: (username: string, password: string) =>
    call<AuthResponse>('/api/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  deleteAccount: (token: string, password?: string) =>
    call<{ ok: boolean; deletedPresentations: number }>('/api/users/me', { method: 'DELETE', body: JSON.stringify(password ? { password } : {}) }, token),
  createProfile: (token: string, name: string) =>
    call<{ user: PublicUser }>('/api/users/profile', { method: 'POST', body: JSON.stringify({ name }) }, token),
  me: (token: string) => call<{ user: PublicUser }>('/api/users/me', {}, token),
  claimLegacy: (token: string, username: string, password: string) =>
    call<{ user: PublicUser }>('/api/users/claim-legacy', { method: 'POST', body: JSON.stringify({ username, password }) }, token),
  myPresentations: (token: string) => call<{ data: unknown[] }>('/api/presentations', {}, token),
  createPresentation: (token: string, payload: unknown) =>
    call<{ data: Record<string, unknown> }>('/api/presentations', { method: 'POST', body: JSON.stringify(payload) }, token),
  getPresentation: (token: string, id: string) => call<{ data: Record<string, unknown> }>(`/api/presentations/${id}`, {}, token),
  updatePresentation: (token: string, id: string, payload: unknown) =>
    call<{ data: Record<string, unknown> }>(`/api/presentations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  deletePresentation: (token: string, id: string) =>
    call<{ data: unknown }>(`/api/presentations/${id}`, { method: 'DELETE' }, token),
  presenterAction: (token: string, id: string, action: Record<string, unknown>) =>
    call<{ ok: boolean; state: unknown }>(`/api/presentations/${id}/live-actions`, { method: 'POST', body: JSON.stringify(action) }, token),
  joinByCode: (accessCode: string) => call<{ data: { title: string; accessCode: string } }>(`/api/presentations/code/${accessCode}`),
};
