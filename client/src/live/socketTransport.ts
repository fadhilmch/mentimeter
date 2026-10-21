import { io, type Socket } from 'socket.io-client';
import type { LiveAction, LiveTransport, PresentationState } from '../types';

export function createSocketTransport(url?: string): LiveTransport {
  const socket: Socket = io(url ?? '/', { transports: ['websocket', 'polling'] });
  return {
    join(accessCode) {
      return new Promise((resolve, reject) => {
        socket.emit('presentation:join', { accessCode }, (res: { ok: boolean; state?: PresentationState; message?: string }) => {
          if (res.ok && res.state) resolve(res.state);
          else reject(new Error(res.message ?? 'Could not join'));
        });
      });
    },
    send(action: LiveAction) {
      return new Promise((resolve, reject) => {
        socket.emit('live:action', action, (res: { ok: boolean; message?: string }) => {
          if (res.ok) resolve();
          else reject(new Error(res.message ?? 'Action failed'));
        });
      });
    },
    onState(handler) {
      socket.on('presentation:state', handler);
    },
    leave() {
      socket.disconnect();
    },
  };
}
