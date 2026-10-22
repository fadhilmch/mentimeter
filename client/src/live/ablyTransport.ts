import * as Ably from 'ably';
import type { LiveAction, LiveTransport, PresentationState } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';

/** The parts of the Ably SDK this transport uses, so tests can pass a fake. */
export interface AblyDeps {
  Realtime: new (options: Ably.ClientOptions) => Ably.Realtime;
  fetch: typeof fetch;
  /** Request deadline in ms (default 10s), so a stalled network cannot leave a tap hanging forever. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** The outcome is unknown: it may have been saved. Never tell the player to just resend. */
const NO_ANSWER = "We couldn't confirm that your answer arrived. Check the screen before sending it again.";

/** fetch with a deadline: a timeout becomes the same plain message the socket transport uses. */
async function fetchWithDeadline(deps: AblyDeps, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await deps.fetch(url, { ...init, signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new Error(NO_ANSWER);
    throw err;
  }
}

/** Fetches a subscribe-only token request. The server wraps it as `{ tokenRequest }`. */
async function fetchTokenRequest(deps: AblyDeps, accessCode: string) {
  const res = await fetchWithDeadline(deps, `${base}/api/live/${accessCode}/token`);
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

  async function loadState(accessCode: string): Promise<PresentationState> {
    const res = await fetchWithDeadline(deps, `${base}/api/live/${accessCode}/state`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message ?? 'Could not load presentation');
    return body.data as PresentationState;
  }

  return {
    async join(accessCode) {
      close();
      try {
        await fetchTokenRequest(deps, accessCode);
        client = new deps.Realtime({
          authCallback: (_params, cb) => {
            fetchTokenRequest(deps, accessCode).then(
              (tokenRequest) => cb(null, tokenRequest),
              (err) => cb(err instanceof Error ? err.message : String(err), null),
            );
          },
        });
        channel = client.channels.get(`presentation:${accessCode}`);
        // Subscribe before attaching so no state is missed, and so a handler
        // registered before join keeps working.
        await channel.subscribe('state', listener);
        const initial = await loadState(accessCode);
        // After a dropped connection Ably may re-attach without the missed messages. Reload the
        // current state then, so a phone never keeps showing a slide the presenter already left.
        let attachedOnce = false;
        channel.on('attached', (change) => {
          if (attachedOnce && !change.resumed) {
            loadState(accessCode).then((fresh) => handler?.(fresh), () => { /* the next state message or reconnect retries */ });
          }
          attachedOnce = true;
        });
        return initial;
      } catch (err) {
        close();
        throw err;
      }
    },
    async send(action) {
      if (!channel) throw new Error('Join a presentation first');
      const accessCode = channel.name.replace('presentation:', '');
      let res: Response;
      try {
        res = await fetchWithDeadline(deps, `${base}/api/live/${accessCode}/action`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action),
        });
      } catch (err) {
        // Unknown outcome. Pull the authoritative state so the screen shows what was saved,
        // then let the caller report the uncertainty (best effort: the resync itself may fail too).
        if (err instanceof Error && err.message === NO_ANSWER) {
          loadState(accessCode).then((fresh) => handler?.(fresh), () => {});
        }
        throw err;
      }
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
