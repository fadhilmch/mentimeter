const base = import.meta.env.VITE_API_URL ?? '';

async function call<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
  return body as T;
}

export interface PublicUser { id: string; name: string; username: string }
export interface AuthResponse { token: string; user: PublicUser }

export const api = {
  signup: (name: string, username: string, password: string) =>
    call<AuthResponse>('/api/users/signup', { method: 'POST', body: JSON.stringify({ name, username, password }) }),
  login: (username: string, password: string) =>
    call<AuthResponse>('/api/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
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
