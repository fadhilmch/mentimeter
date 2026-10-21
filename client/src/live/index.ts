import type { LiveTransport } from '../types';
import { createSocketTransport } from './socketTransport';
import { createAblyTransport } from './ablyTransport';

/** VITE_LIVE_MODE=ably selects the serverless transport; default is self-hosted Socket.IO. */
export function createLiveTransport(): LiveTransport {
  if (import.meta.env.VITE_LIVE_MODE === 'ably') return createAblyTransport();
  return createSocketTransport(import.meta.env.VITE_SOCKET_URL);
}
