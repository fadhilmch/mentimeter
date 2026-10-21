/**
 * Lets authenticated REST routes trigger the same live broadcast the socket
 * layer owns, without importing the socket server into route modules.
 */
let broadcaster = null;

export function setBroadcaster(fn) {
  broadcaster = fn;
}

export async function broadcastState(accessCode) {
  if (broadcaster) await broadcaster(accessCode);
}
