import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { applyLiveActionByCode, liveActionSchema, publicState, liveChannel } from '../lib/live.js';
import { guardAudienceAction } from '../lib/audience.js';
import { publishState } from '../ably.js';
import { setBroadcaster } from '../lib/broadcast.js';

const joinSchema = z.object({ accessCode: z.string().trim().min(1) });

async function broadcastState(io, accessCode) {
  const presentation = await Presentation.findOne({ accessCode });
  if (!presentation) return;
  const state = publicState(presentation);
  io.to(liveChannel(accessCode)).emit('presentation:state', state);
  await publishState(accessCode, state);
}

/**
 * Live room protocol over Socket.IO (self-hosted transport).
 * One room per access code; mutations persist first, then a fresh snapshot is broadcast.
 */
export function registerPresentationSockets(io) {
  setBroadcaster((accessCode) => broadcastState(io, accessCode));
  io.on('connection', (socket) => {
    let joinedCode = null;

    socket.on('presentation:join', async (payload, ack = () => {}) => {
      try {
        const { accessCode } = joinSchema.parse(payload);
        const presentation = await Presentation.findOne({ accessCode });
        if (!presentation) return ack({ ok: false, message: 'No presentation with that code' });
        if (joinedCode) socket.leave(liveChannel(joinedCode));
        joinedCode = accessCode;
        await socket.join(liveChannel(accessCode));
        return ack({ ok: true, state: publicState(presentation) });
      } catch (err) {
        return ack({ ok: false, message: err.message });
      }
    });

    socket.on('live:action', async (payload, ack = () => {}) => {
      if (!joinedCode) return ack({ ok: false, message: 'Join a presentation first' });
      try {
        const action = liveActionSchema.parse({ type: payload?.type, ...payload });
        guardAudienceAction({ accessCode: joinedCode, action, token: payload?.token, ip: socket.handshake?.address });
        const presentation = await applyLiveActionByCode(joinedCode, action);
        if (!presentation) return ack({ ok: false, message: 'Presentation is gone' });
        await broadcastState(io, joinedCode);
        return ack({ ok: true });
      } catch (err) {
        return ack({ ok: false, message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}) });
      }
    });
  });
}
