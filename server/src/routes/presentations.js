import { Router } from 'express';
import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateUniqueAccessCode } from '../lib/accessCode.js';
import { ensureSlideIds, hasUnidentifiedSlides, matchSlideUpdate, stampSlideIdsIfMissing } from '../lib/slideIdentity.js';
import { presenterActionSchema, applyLiveAction, publicState } from '../lib/live.js';
import { broadcastState } from '../lib/broadcast.js';
import { config } from '../config.js';

// Options arrive either as legacy plain strings or as { id?, text } objects.
const optionInputSchema = z.union([
  z.string().trim().min(1).max(200),
  z.object({ id: z.string().min(1).max(64).optional(), text: z.string().trim().min(1).max(200) }),
]);

const normalizeOption = (option) => (typeof option === 'string' ? { text: option } : option);

const designInputSchema = z
  .object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    imageUrl: z.string().trim().url().max(500).optional(),
    imageLayout: z.enum(['beside', 'behind']).optional(),
  })
  .optional();

const slideSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    questionType: z.enum(['multiple-choice', 'open-ended', 'word-cloud', 'rating', 'ranking', 'quiz']),
    question: z.string().trim().min(1).max(300),
    options: z.array(optionInputSchema).max(12).default([]),
    correctOptionId: z.string().min(1).max(64).optional(),
    design: designInputSchema,
  })
  .superRefine((slide, ctx) => {
    if (slide.questionType === 'multiple-choice' && slide.options.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'Multiple-choice slides need at least 2 options', path: ['options'] });
    }
    if ((slide.questionType === 'ranking' || slide.questionType === 'quiz') && slide.options.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'Ranking and quiz slides need at least 2 options', path: ['options'] });
    }
    if (slide.design?.imageLayout && !slide.design?.imageUrl) {
      ctx.addIssue({ code: 'custom', message: 'Image layout only applies when an image is set', path: ['design'] });
    }
  });

const confirmRemoveSchema = z.object({
  votes: z.number().int().min(0),
  responses: z.number().int().min(0),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional(),
  theme: z.enum(['iris', 'apricot', 'plum', 'cobalt']).optional(),
  slides: z.array(slideSchema).max(50).default([]),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  theme: z.enum(['iris', 'apricot', 'plum', 'cobalt']).optional(),
  slides: z.array(slideSchema).max(50).optional(),
  currentSlide: z.number().int().min(0).optional(),
  baseStructureRevision: z.number().int().min(0).optional(),
  confirmRemove: confirmRemoveSchema.optional(),
});

export const presentationsRouter = Router();

const codeExists = async (code) => Boolean(await Presentation.exists({ accessCode: code }));

presentationsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await Presentation.find({ owner: req.auth.userId }).sort('-createdAt');
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

presentationsRouter.post('/', authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const accessCode = await generateUniqueAccessCode(codeExists, config.accessCode);
    const slides = req.body.slides.map((slide) => ({
      ...slide,
      options: slide.options.map(normalizeOption).map((option) => ({ ...option, votes: [] })),
      responses: [],
      ratings: [],
      rankings: [],
    }));
    const data = await Presentation.create({ ...req.body, slides, accessCode, owner: req.auth.userId });
    ensureSlideIds(data);
    await data.save();
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

/** Public join-by-code: audience needs no account. */
presentationsRouter.get('/code/:accessCode', async (req, res, next) => {
  try {
    const data = await Presentation.findOne({ accessCode: req.params.accessCode });
    if (!data) return res.status(404).json({ message: 'No presentation with that code' });
    return res.json({ data: publicState(data) });
  } catch (err) {
    return next(err);
  }
});

presentationsRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    let data = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!data) return res.status(404).json({ message: 'Presentation not found' });
    // Upgrade-on-read: stamp stable ids onto pre-identity decks. This is purely
    // additive (no votes, responses or structure are touched) and gives the
    // editor real identities to echo back on save. The write is version-guarded:
    // a concurrent change wins, and the winner may be a vote, which stamps
    // nothing - so reload and retry instead of returning an unidentified deck.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await stampSlideIdsIfMissing(data)) break;
      data = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
      if (!data) return res.status(404).json({ message: 'Presentation not found' });
    }
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

presentationsRouter.put('/:id', authenticate, validate(updateSchema), async (req, res, next) => {
  try {
    const presentation = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!presentation) return res.status(404).json({ message: 'Presentation not found' });
    const { slides, baseStructureRevision, confirmRemove, ...rest } = req.body;
    Object.assign(presentation, rest);
    if (slides) {
      if (hasUnidentifiedSlides(presentation.slides)) {
        // Pre-identity deck: stamp ids additively and ask the client to reload.
        // Never index-match legacy data - that is how votes get misattached.
        // Version-guarded write; on contention the other writer's ids win.
        await stampSlideIdsIfMissing(presentation);
        return res.status(409).json({
          code: 'upgraded',
          message: 'This presentation was just upgraded for safer editing. Reload it and save again.',
        });
      }
      const normalized = slides.map((slide) => ({ ...slide, options: slide.options.map(normalizeOption) }));
      if (baseStructureRevision === undefined || (normalized.length > 0 && normalized.every((s) => !s.id))) {
        // The client is not echoing identities; it may hold stale data. Reject
        // rather than guess: no attachment beats wrong attachment.
        return res.status(409).json({ code: 'stale', message: 'Reload the presentation before saving.' });
      }
      if (baseStructureRevision !== presentation.structureRevision) {
        return res.status(409).json({ code: 'conflict', message: 'Someone changed these slides elsewhere. Reload before saving.' });
      }
      const { merged, removedVotes, removedResponses } = matchSlideUpdate(presentation.slides, normalized);
      if (removedVotes > 0 || removedResponses > 0) {
        // Discarding real audience data requires an explicit, count-aware
        // confirmation computed against the current stored document. Counts
        // that went stale (new votes meanwhile) fail this check.
        if (!confirmRemove || confirmRemove.votes !== removedVotes || confirmRemove.responses !== removedResponses) {
          return res.status(409).json({
            code: 'requiresConfirmation',
            message: 'Saving removes slides or options that already have audience results.',
            removedVotes,
            removedResponses,
          });
        }
      }
      const currentSlideId = presentation.slides[presentation.currentSlide]?.id;
      presentation.slides = merged;
      if (currentSlideId) {
        const nextIndex = merged.findIndex((s) => s.id === currentSlideId);
        presentation.currentSlide = nextIndex >= 0 ? nextIndex : Math.max(0, merged.length - 1);
      } else if (presentation.currentSlide >= merged.length) {
        presentation.currentSlide = Math.max(0, merged.length - 1);
      }
      presentation.structureRevision += 1;
    }
    const data = await presentation.save();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

/**
 * Presenter-only live controls (vote reset, open/close voting, hide/reveal
 * results). Authenticated + owner-scoped, unlike the public live channels.
 */
presentationsRouter.post('/:id/live-actions', authenticate, async (req, res, next) => {
  try {
    const action = presenterActionSchema.parse(req.body);
    const presentation = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!presentation) return res.status(404).json({ message: 'Presentation not found' });
    applyLiveAction(presentation, action);
    const data = await presentation.save();
    await broadcastState(data.accessCode);
    return res.json({ ok: true, state: publicState(data) });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ message: 'Invalid action', issues: err.issues });
    if (err instanceof RangeError || err instanceof TypeError) return res.status(400).json({ message: err.message });
    return next(err);
  }
});

presentationsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const data = await Presentation.findOneAndDelete({ _id: req.params.id, owner: req.auth.userId });
    if (!data) return res.status(404).json({ message: 'Presentation not found' });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});
