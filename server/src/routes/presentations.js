import { Router } from 'express';
import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateUniqueAccessCode } from '../lib/accessCode.js';
import { presenterActionSchema, applyLiveAction, publicState } from '../lib/live.js';
import { broadcastState } from '../lib/broadcast.js';
import { config } from '../config.js';

const slideSchema = z.object({
  questionType: z.enum(['multiple-choice', 'open-ended']),
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
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
      options: slide.options.map((text) => ({ text, votes: [] })),
      responses: [],
    }));
    const data = await Presentation.create({ ...req.body, slides, accessCode, owner: req.auth.userId });
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
    const data = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!data) return res.status(404).json({ message: 'Presentation not found' });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

presentationsRouter.put('/:id', authenticate, validate(updateSchema), async (req, res, next) => {
  try {
    const presentation = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!presentation) return res.status(404).json({ message: 'Presentation not found' });
    const { slides, ...rest } = req.body;
    Object.assign(presentation, rest);
    if (slides) {
      // Edits replace questions and options but keep already-cast votes and responses.
      presentation.slides = slides.map((slide, index) => {
        const previous = presentation.slides[index];
        return {
          ...slide,
          options: slide.options.map((text, optionIndex) => ({
            text,
            votes: previous?.options?.[optionIndex]?.votes ?? [],
          })),
          responses: previous?.responses ?? [],
        };
      });
      if (presentation.currentSlide >= presentation.slides.length) {
        presentation.currentSlide = Math.max(0, presentation.slides.length - 1);
      }
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
