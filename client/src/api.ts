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
    call<{ ok: boolean; deletedPresentations: number; firebaseLoginRemoved?: boolean }>('/api/users/me', { method: 'DELETE', body: JSON.stringify(password ? { password } : {}) }, token),
  createProfile: (token: string, name: string) =>
    call<{ user: PublicUser }>('/api/users/profile', { method: 'POST', body: JSON.stringify({ name }) }, token),
  me: (token: string) => call<{ user: PublicUser }>('/api/users/me', {}, token),
  claimLegacy: (token: string, username: string, password: string) =>
    call<{ user: PublicUser }>('/api/users/claim-legacy', { method: 'POST', body: JSON.stringify({ username, password }) }, token),
  myPresentations: (token: string, cursor?: string | null) =>
    call<{ data: unknown[]; total: number; nextCursor: string | null }>(`/api/presentations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {}, token),
  createPresentation: (token: string, payload: unknown) =>
    call<{ data: Record<string, unknown> }>('/api/presentations', { method: 'POST', body: JSON.stringify(payload) }, token),
  templates: (token: string) => call<{ data: { key: string; name: string; description: string; slideCount: number }[] }>('/api/presentations/templates', {}, token),
  createFromTemplate: (token: string, key: string) =>
    call<{ data: Record<string, unknown> }>(`/api/presentations/from-template/${key}`, { method: 'POST' }, token),
  duplicatePresentation: (token: string, id: string) =>
    call<{ data: Record<string, unknown> }>(`/api/presentations/${id}/duplicate`, { method: 'POST' }, token),
  getPresentation: (token: string, id: string) => call<{ data: Record<string, unknown> }>(`/api/presentations/${id}`, {}, token),
  sessionAction: (token: string, sid: string, action: 'end' | 'archive') =>
    call<{ data: unknown }>(`/api/sessions/${sid}/${action}`, { method: 'POST' }, token),
  deleteSession: (token: string, sid: string) => call<unknown>(`/api/sessions/${sid}`, { method: 'DELETE' }, token),
  getSessionReport: (token: string, sid: string) => call<{ data: Record<string, unknown> }>(`/api/sessions/${sid}/report`, {}, token),
  listSessions: (token: string, presentationId: string) =>
    call<{ data: { id: string; code: string; status: string; startedAt: string; endedAt: string | null }[] }>(`/api/presentations/${presentationId}/sessions`, {}, token),
  getReport: (token: string, id: string) => call<{ data: Record<string, unknown> }>(`/api/presentations/${id}/report`, {}, token),
  features: () => call<{ sessions: boolean }>('/api/features', {}),
  startSession: (token: string, presentationId: string) =>
    call<{ data: { id: string; code: string } }>(`/api/presentations/${presentationId}/sessions`, { method: 'POST' }, token),
  updatePresentation: (token: string, id: string, payload: unknown) =>
    call<{ data: Record<string, unknown> }>(`/api/presentations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  deletePresentation: (token: string, id: string) =>
    call<{ data: unknown }>(`/api/presentations/${id}`, { method: 'DELETE' }, token),
  presenterAction: (token: string, id: string, action: Record<string, unknown>) =>
    call<{ ok: boolean; state: unknown }>(`/api/presentations/${id}/live-actions`, { method: 'POST', body: JSON.stringify(action) }, token),
  joinByCode: (accessCode: string) => call<{ data: { title: string; accessCode: string } }>(`/api/presentations/code/${accessCode}`),
};

/** Uploaded slide images live on the API ("/api/media/<id>"). Links to other sites are used as they are. */
export const imageSrc = (url: string | undefined): string | undefined =>
  url && url.startsWith('/api/media/') ? `${base}${url}` : url;

/** Uploads one already-resized image. Sent as raw bytes: the body is not JSON. */
export async function uploadImage(token: string, image: Blob): Promise<string> {
  const fresh = tokenRefresher ? ((await tokenRefresher().catch(() => undefined)) ?? token) : token;
  let res: Response;
  try {
    res = await fetch(`${base}/api/media`, { method: 'POST', headers: { authorization: `Bearer ${fresh}`, 'content-type': image.type }, body: image });
  } catch {
    throw new ApiError(0, { message: "Couldn't reach the server. Check your connection and try again." });
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, body);
  return (body as { data: { url: string } }).data.url;
}

export interface UploadedImage { url: string; bytes: number; createdAt: string; usedIn: { id: string; title: string }[] }

async function mediaRequest(token: string, path: string, method: 'GET' | 'DELETE'): Promise<Record<string, unknown>> {
  const fresh = tokenRefresher ? ((await tokenRefresher().catch(() => undefined)) ?? token) : token;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${fresh}` } });
  } catch {
    throw new ApiError(0, { message: "Couldn't reach the server. Check your connection and try again." });
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as Record<string, unknown>;
}

/** The signed-in owner's uploaded images and where each is used. */
export async function listUploads(token: string): Promise<{ items: UploadedImage[]; limit: number }> {
  const body = await mediaRequest(token, '/api/media', 'GET');
  return { items: body.data as UploadedImage[], limit: body.limit as number };
}

/** Deletes the file itself. The server refuses (409 image_in_use) while a deck still shows it. */
export async function deleteUpload(token: string, url: string): Promise<void> {
  await mediaRequest(token, url, 'DELETE');
}

export interface ModerationItem { slideId: string; slideIndex: number; question: string; id: string; status: 'pending' | 'hidden'; text: string; createdAt?: string }
export interface ModerationQueue { mode: 'off' | 'approve'; items: ModerationItem[]; log: { action: string; at: string }[] }
export type ModerationAction = 'approve' | 'hide' | 'restore' | 'delete';

export const moderationApi = {
  queue: (token: string, id: string) => call<{ data: ModerationQueue }>(`/api/presentations/${id}/moderation`, {}, token),
  setMode: (token: string, id: string, mode: 'off' | 'approve') =>
    call<{ data: ModerationQueue; state: unknown }>(`/api/presentations/${id}/moderation/mode`, { method: 'POST', body: JSON.stringify({ mode }) }, token),
  act: (token: string, id: string, slideId: string, responseId: string, action: ModerationAction) =>
    call<{ data: ModerationQueue; state: unknown }>(`/api/presentations/${id}/moderation/${encodeURIComponent(slideId)}/${encodeURIComponent(responseId)}`, { method: 'POST', body: JSON.stringify({ action }) }, token),
};
