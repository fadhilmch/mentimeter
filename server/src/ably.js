import Ably from 'ably';
import { liveChannel } from './lib/live.js';

let rest = null;

/** Ably publishing is optional: only active when ABLY_API_KEY is configured. */
export function getAblyRest() {
  if (!process.env.ABLY_API_KEY) return null;
  if (!rest) rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  return rest;
}

export async function publishState(accessCode, state) {
  const ably = getAblyRest();
  if (!ably) return false;
  await ably.channels.get(liveChannel(accessCode)).publish('state', state);
  return true;
}

/** Issues a subscribe-only token for one presentation channel. */
export async function createSubscriberToken(accessCode, clientId) {
  const ably = getAblyRest();
  if (!ably) throw new Error('Ably is not configured');
  const capability = { [liveChannel(accessCode)]: ['subscribe', 'presence'] };
  return ably.auth.createTokenRequest({ clientId, capability, ttl: 60 * 60 * 1000 });
}
