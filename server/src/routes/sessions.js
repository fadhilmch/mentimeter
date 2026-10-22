import { Router } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Presentation } from '../models/presentation.js';
import { LiveSession } from '../models/liveSession.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateUniqueAccessCode } from '../lib/accessCode.js';
import { config } from '../config.js';

/**
 * Owner session lifecycle. Mounted only when SESSIONS_ENABLED=true (see app.js), so production
 * behaviour is unchanged until the owner turns it on, after running the migration.
 *
 * These routes manage sessions only. Audience answers still go to the deck until live actions are
 * pointed at sessions, which is the next step in docs/live-sessions.md.
 */
export const sessionsRouter = Router();

const codeExists = async (code) =>
  Boolean((await Presentation.exists({ accessCode: code })) || (await LiveSession.exists({ code, status: 'active' })));

const blankSlides = (slides) =>
  slides.map((slide) => {
    const options = (slide.options ?? []).map((o) => ({ id: randomUUID(), text: o.text, votes: [] }));
    const correctAt = (slide.options ?? []).findIndex((o) => o.id && o.id === slide.correctOptionId);
    const design = slide.design?.toObject ? slide.design.toObject() : slide.design;
    return {
      id: slide.id ?? randomUUID(),
      questionType: slide.questionType,
      question: slide.question,
      options,
      responses: [],
      ratings: [],
      rankings: [],
      revealed: false,
      ...(correctAt >= 0 ? { correctOptionId: options[correctAt].id } : {}),
      ...(design ? { design } : {}),
    };
  });

const summary = (s) => ({
  id: s._id, presentation: s.presentation, title: s.title, code: s.code, status: s.status,
  startedAt: s.startedAt, endedAt: s.endedAt ?? null, slideCount: s.slides.length,
});

async function ownedSession(req) {
  if (!mongoose.isValidObjectId(req.params.sid)) return null;
  return LiveSession.findOne({ _id: req.params.sid, owner: req.auth.userId });
}

// Start a session for a deck (also "run it again": every start is a new session with a new code and no answers).
sessionsRouter.post('/presentations/:id/sessions', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Presentation not found' });
    const deck = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!deck) return res.status(404).json({ message: 'Presentation not found' });
    const code = await generateUniqueAccessCode(codeExists, config.accessCode);
    const session = await LiveSession.create({
      owner: req.auth.userId,
      presentation: deck._id,
      deckRevision: deck.structureRevision ?? 0,
      title: deck.title,
      theme: deck.theme,
      slides: blankSlides(deck.slides),
      code,
    });
    return res.status(201).json({ data: summary(session) });
  } catch (err) {
    return next(err);
  }
});

sessionsRouter.get('/presentations/:id/sessions', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Presentation not found' });
    const sessions = await LiveSession.find({ presentation: req.params.id, owner: req.auth.userId }).sort({ startedAt: -1 }).limit(100);
    return res.json({ data: sessions.map(summary) });
  } catch (err) {
    return next(err);
  }
});

// End: stops accepting the join code (the unique code index only covers active sessions).
sessionsRouter.post('/sessions/:sid/end', authenticate, async (req, res, next) => {
  try {
    const s = await ownedSession(req);
    if (!s) return res.status(404).json({ message: 'Session not found' });
    if (s.status === 'active') {
      s.status = 'ended';
      s.endedAt = new Date();
      s.votingOpen = false;
      await s.save();
    }
    return res.json({ data: summary(s) });
  } catch (err) {
    return next(err);
  }
});

sessionsRouter.post('/sessions/:sid/archive', authenticate, async (req, res, next) => {
  try {
    const s = await ownedSession(req);
    if (!s) return res.status(404).json({ message: 'Session not found' });
    if (s.status === 'active') return res.status(409).json({ message: 'End the session before archiving it' });
    s.status = 'archived';
    await s.save();
    return res.json({ data: summary(s) });
  } catch (err) {
    return next(err);
  }
});

// Delete removes the session and its answers for good. Active sessions must be ended first.
sessionsRouter.delete('/sessions/:sid', authenticate, async (req, res, next) => {
  try {
    const s = await ownedSession(req);
    if (!s) return res.status(404).json({ message: 'Session not found' });
    if (s.status === 'active') return res.status(409).json({ message: 'End the session before deleting it' });
    await s.deleteOne();
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});
