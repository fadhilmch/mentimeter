import { io, type Socket } from 'socket.io-client';
import type { LiveAction, LiveTransport, PresentationState } from '../types';

/** How long to wait for the server to acknowledge before giving up, so the UI never waits forever. */
export const ACK_TIMEOUT_MS = 10_000;

type JoinAck = { ok: boolean; state?: PresentationState; message?: string };
type ActionAck = { ok: boolean; message?: string };

/** Just the Socket.IO surface this transport uses, so tests can pass a fake. */
export type SocketLike = Pick<Socket, 'on' | 'off' | 'disconnect'> & {
  timeout(ms: number): { emit(event: string, payload: unknown, cb: (err: Error | null, res: never) => void): unknown };
};

export function createSocketTransport(url?: string, socketFactory: () => SocketLike = () => io(url ?? '/', { transports: ['websocket', 'polling'] }) as unknown as SocketLike): LiveTransport {
  const socket = socketFactory();
  let accessCode: string | null = null;
  let handler: ((state: PresentationState) => void) | null = null;
  let reconnected: (() => void) | null = null;

  const emit = <T>(event: string, payload: unknown, noReply: string) =>
    new Promise<T>((resolve, reject) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err: Error | null, res: never) => {
        if (err) reject(new Error(noReply));
        else resolve(res as T);
      });
    });

  // After a dropped connection the server has forgotten which room this socket was in.
  // Join again and take the fresh snapshot so the screen does not silently go stale.
  //
  // Until that rejoin is acknowledged, answers are held back. Socket.IO would otherwise buffer
  // them while offline and flush them the moment the socket reconnects, ahead of the rejoin, and
  // the server refuses an answer from a socket that has not joined the room.
  let dropped = false;
  let waiting: Array<() => void> = [];
  socket.on('disconnect', () => { if (accessCode) dropped = true; });
  socket.on('connect', () => {
    if (!accessCode) return;
    emit<JoinAck>('presentation:join', { accessCode }, 'Reconnect timed out')
      .then((res) => {
        if (!res.ok || !res.state) return;
        handler?.(res.state);
        dropped = false;
        const release = waiting;
        waiting = [];
        release.forEach((go) => go());
        reconnected?.();
      })
      .catch(() => { /* the next reconnect tries again */ });
  });

  /** Resolves once the room is joined again; rejects after the usual wait, with nothing having been sent. */
  const untilRejoined = () =>
    new Promise<void>((resolve, reject) => {
      const go = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        waiting = waiting.filter((fn) => fn !== go);
        reject(new Error('Not connected. Your answer was not sent, try again.'));
      }, ACK_TIMEOUT_MS);
      waiting.push(go);
    });

  return {
    async join(code) {
      const res = await emit<JoinAck>('presentation:join', { accessCode: code }, 'Could not reach the server. Check your connection and try again.');
      if (!res.ok || !res.state) throw new Error(res.message ?? 'Could not join');
      accessCode = code;
      return res.state;
    },
    async send(action: LiveAction) {
      if (dropped) await untilRejoined(); // otherwise emit immediately
      const res = await emit<ActionAck>('live:action', action, 'No answer from the server. Your answer may not have been saved, try again.');
      if (!res.ok) throw new Error(res.message ?? 'Action failed');
    },
    onState(next) {
      handler = next;
      socket.on('presentation:state', next);
    },
    onReconnect(next) {
      reconnected = next;
    },
    leave() {
      accessCode = null;
      handler = null;
      reconnected = null;
      socket.disconnect();
    },
  };
}
