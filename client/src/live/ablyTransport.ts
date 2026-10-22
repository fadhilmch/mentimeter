import * as Ably from 'ably';
import type { LiveAction, LiveTransport, PresentationState } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';

/** The parts of the Ably SDK this transport uses, so tests can pass a fake. */
export interface AblyDeps {
  Realtime: new (options: Ably.ClientOptions) => Ably.Realtime;
  fetch: typeof fetch;
}

/** Fetches a subscribe-only token request. The server wraps it as `{ tokenRequest }`. */
async function fetchTokenRequest(doFetch: typeof fetch, accessCode: string) {
  const res = await doFetch(`${base}/api/live/${accessCode}/token`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.tokenRequest) throw new Error(body.message ?? 'Could not join');
  return body.tokenRequest as Ably.TokenRequest;
}

/**
 * Ably transport for serverless hosting: mutations go over HTTP, state
 * arrives on the presentation channel with a subscribe-only token.
 */
export function createAblyTransport(deps: AblyDeps = { Realtime: Ably.Realtime, fetch: (...a) => fetch(...a) }): LiveTransport {
  let client: Ably.Realtime | null = null;
  let channel: Ably.RealtimeChannel | null = null;
  let handler: ((state: PresentationState) => void) | null = null;
  const listener = (message: Ably.InboundMessage) => handler?.(message.data as PresentationState);

  const close = () => {
    channel?.unsubscribe('state', listener);
    client?.close();
    client = null;
    channel = null;
  };

  return {
    async join(accessCode) {
      close();
      try {
        await fetchTokenRequest(deps.fetch, accessCode);
        client = new deps.Realtime({
          authCallback: (_params, cb) => {
            fetchTokenRequest(deps.fetch, accessCode).then(
              (tokenRequest) => cb(null, tokenRequest),
              (err) => cb(err instanceof Error ? err.message : String(err), null),
            );
          },
        });
        channel = client.channels.get(`presentation:${accessCode}`);
        // Subscribe before attaching so no state is missed, and so a handler
        // registered before join keeps working.
        await channel.subscribe('state', listener);
        const stateRes = await deps.fetch(`${base}/api/live/${accessCode}/state`);
        const stateBody = await stateRes.json().catch(() => ({}));
        if (!stateRes.ok) throw new Error(stateBody.message ?? 'Could not load presentation');
        return stateBody.data as PresentationState;
      } catch (err) {
        close();
        throw err;
      }
    },
    async send(action) {
      if (!channel) throw new Error('Join a presentation first');
      const accessCode = channel.name.replace('presentation:', '');
      // The credential travels in a header, not in the stored body.
      const { token, ...rest } = action as LiveAction & { token?: string };
      const res = await deps.fetch(`${base}/api/live/${accessCode}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { 'x-participant-token': token } : {}) },
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Action failed');
      }
    },
    onState(next) {
      handler = next;
    },
    leave() {
      handler = null;
      close();
    },
  };
}
