import * as Ably from 'ably';
import type { LiveAction, LiveTransport, PresentationState } from '../types';

const base = import.meta.env.VITE_API_URL ?? '';

/**
 * Ably transport for serverless hosting: mutations go over HTTP, state
 * arrives on the presentation channel with a subscribe-only token.
 */
export function createAblyTransport(): LiveTransport {
  let client: Ably.Realtime | null = null;
  let channel: Ably.RealtimeChannel | null = null;
  return {
    async join(accessCode) {
      const res = await fetch(`${base}/api/live/${accessCode}/token`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Could not join');
      client = new Ably.Realtime({ authCallback: async (_, cb) => {
        try {
          const fresh = await fetch(`${base}/api/live/${accessCode}/token`);
          cb(null, await fresh.json());
        } catch (err) {
          cb(String(err), null);
        }
      } });
      channel = client.channels.get(`presentation:${accessCode}`);
      await channel.attach();
      const stateRes = await fetch(`${base}/api/live/${accessCode}/state`);
      const stateBody = await stateRes.json();
      if (!stateRes.ok) throw new Error(stateBody.message ?? 'Could not load presentation');
      return stateBody.data as PresentationState;
    },
    async send(action) {
      if (!channel) throw new Error('Join a presentation first');
      const accessCode = channel.name.replace('presentation:', '');
      const res = await fetch(`${base}/api/live/${accessCode}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Action failed');
      }
    },
    onState(handler) {
      channel?.subscribe('state', (message) => handler(message.data as PresentationState));
    },
    leave() {
      channel?.unsubscribe();
      client?.close();
    },
  };
}
