/**
 * Lets authenticated REST routes trigger the same live broadcast the socket
 * layer owns, without importing the socket server into route modules.
 */
import { publishState } from '../ably.js';

let broadcaster = null;

export function setBroadcaster(fn) {
  broadcaster = fn;
}

/**
 * With the socket layer running it owns publication (it also publishes to Ably).
 * On serverless there is no socket layer, so publish the given state to Ably directly;
 * otherwise a presenter's slide change or voting control would be saved but never reach phones.
 */
export async function broadcastState(accessCode, state) {
  if (broadcaster) return state?.ended ? broadcaster(accessCode, state) : broadcaster(accessCode);
  if (!state) return;
  try {
    await publishState(accessCode, state);
  } catch (err) {
    // The change is already saved and the presenter gets the new state in the HTTP response;
    // phones catch up on their next state read.
    console.error('Live publish failed after save:', err?.message ?? err);
  }
}
