import { Router } from 'express';
import { Presentation } from '../models/presentation.js';
import { applyLiveActionByCode, liveActionSchema, publicState } from '../lib/live.js';
import { answersFor } from '../lib/answers.js';
import { createSubscriberToken, publishState, getAblyRest } from '../ably.js';

/**
 * HTTP live endpoints used with the Ably transport (e.g. on serverless hosts
 * where a persistent Socket.IO server is not available).
 */
export const liveRouter = Router();

liveRouter.get('/:accessCode/token', async (req, res, next) => {
  try {
    if (!getAblyRest()) return res.status(501).json({ message: 'Ably transport is not configured' });
    const presentation = await Presentation.exists({ accessCode: req.params.accessCode });
    if (!presentation) return res.status(404).json({ message: 'No presentation with that code' });
    const tokenRequest = await createSubscriberToken(req.params.accessCode, req.query.clientId ?? 'anonymous');
    return res.json({ tokenRequest });
  } catch (err) {
    return next(err);
  }
});


liveRouter.get('/:accessCode/state', async (req, res, next) => {
  try {
    const presentation = await Presentation.findOne({ accessCode: req.params.accessCode });
    if (!presentation) return res.status(404).json({ message: 'No presentation with that code' });
    return res.json({ data: publicState(presentation) });
  } catch (err) {
    return next(err);
  }
});

/** The caller's own answers, keyed by the anonymous participant id sent in a header (kept out of URLs and logs). */
liveRouter.get('/:accessCode/me', async (req, res, next) => {
  try {
    const participantId = req.get('x-participant-id');
    if (!participantId || participantId.length < 6 || participantId.length > 64) {
      return res.status(400).json({ message: 'x-participant-id header is required' });
    }
    const presentation = await Presentation.findOne({ accessCode: req.params.accessCode });
    if (!presentation) return res.status(404).json({ message: 'No presentation with that code' });
    res.set("Cache-Control", "private, no-store");
    res.vary("x-participant-id");
    return res.json({ data: answersFor(presentation, participantId) });
  } catch (err) {
    return next(err);
  }
});

liveRouter.post('/:accessCode/action', async (req, res, next) => {
  try {
    const action = liveActionSchema.parse(req.body);
    const presentation = await applyLiveActionByCode(req.params.accessCode, action);
    if (!presentation) return res.status(404).json({ message: 'No presentation with that code' });
    const state = publicState(presentation);
    await publishState(req.params.accessCode, state);
    return res.json({ ok: true, state });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid action', issues: err.issues });
    }
    if (err instanceof RangeError || err instanceof TypeError) {
      return res.status(400).json({ message: err.message });
    }
    return next(err);
  }
});
