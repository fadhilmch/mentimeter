import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateUniqueAccessCode } from '../lib/accessCode.js';
import { ensureSlideIds, hasUnidentifiedSlides, matchSlideUpdate, stampSlideIdsIfMissing } from '../lib/slideIdentity.js';
import { presenterActionSchema, applyLiveAction, publicState } from '../lib/live.js';
import { tallySlide } from '../lib/results.js';
import { summaryCsv, responsesCsv, leaderboardCsv } from '../lib/csvReport.js';
import { templates, templateList } from '../lib/templates.js';
import { randomUUID } from 'node:crypto';
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

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  // Opaque cursor from the previous page: "<createdAt ms>_<id>".
  cursor: z.string().regex(/^\d+_[a-f0-9]{24}$/).optional(),
});

/**
 * Dashboard listing: metadata only, paginated. Slides, answers and voter ids never leave the
 * database here, so the response size depends on the page size and not on collected answers.
 */
presentationsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid paging parameters' });
    const { limit, cursor } = parsed.data;
    const owner = new mongoose.Types.ObjectId(req.auth.userId);
    const match = { owner };
    if (cursor) {
      const [ms, id] = cursor.split('_');
      const at = new Date(Number(ms));
      const oid = new mongoose.Types.ObjectId(id);
      match.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: oid } }];
    }
    const [rows, total] = await Promise.all([
      Presentation.aggregate([
        { $match: match },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: limit + 1 },
        { $project: { title: 1, accessCode: 1, location: 1, theme: 1, createdAt: 1, updatedAt: 1, slideCount: { $size: { $ifNull: ['$slides', []] } } } },
      ]),
      Presentation.countDocuments({ owner }),
    ]);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? `${new Date(last.createdAt).getTime()}_${last._id}` : null;
    return res.json({ data: page, total, nextCursor });
  } catch (err) {
    return next(err);
  }
});

/** Starter decks. Choose one with POST /from-template/:key. */
presentationsRouter.get('/templates', authenticate, (req, res) => res.json({ data: templateList() }));

presentationsRouter.post('/from-template/:key', authenticate, async (req, res, next) => {
  try {
    const template = templates.find((t) => t.key === req.params.key);
    if (!template) return res.status(404).json({ message: 'No template with that name' });
    const accessCode = await generateUniqueAccessCode(codeExists, config.accessCode);
    const slides = template.slides.map((slide) => {
      const options = slide.options.map((text) => ({ id: randomUUID(), text, votes: [] }));
      return {
        id: randomUUID(),
        questionType: slide.questionType,
        question: slide.question,
        options,
        responses: [],
        ratings: [],
        rankings: [],
        ...(slide.correctIndex !== undefined ? { correctOptionId: options[slide.correctIndex].id } : {}),
      };
    });
    const data = await Presentation.create({ title: template.name, slides, accessCode, owner: req.auth.userId });
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

/**
 * Copies the structure only: fresh deck, slide and option ids, correct answers remapped, design kept.
 * No votes, responses, participants, revealed state or join code are copied.
 */
presentationsRouter.post('/:id/duplicate', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Presentation not found' });
    const source = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!source) return res.status(404).json({ message: 'Presentation not found' });
    const accessCode = await generateUniqueAccessCode(codeExists, config.accessCode);
    const slides = source.slides.map((slide) => {
      const options = slide.options.map((option) => ({ id: randomUUID(), text: option.text, votes: [] }));
      const correctAt = slide.options.findIndex((option) => option.id && option.id === slide.correctOptionId);
      const design = slide.design?.toObject ? slide.design.toObject() : slide.design;
      return {
        id: randomUUID(),
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
    const title = `Copy of ${source.title}`.slice(0, 120);
    const data = await Presentation.create({ title, location: source.location, theme: source.theme, slides, accessCode, owner: req.auth.userId });
    return res.status(201).json({ data });
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

/**
 * Owner-only CSV of the results as they stand now (a snapshot, not a frozen historical report:
 * sessions are not separated from decks yet). kind=summary is aggregate; responses adds open-ended
 * text; leaderboard adds player names and scores and is a deliberate separate choice.
 */
const exporters = { summary: summaryCsv, responses: responsesCsv, leaderboard: leaderboardCsv };
presentationsRouter.get('/:id/export.csv', authenticate, async (req, res, next) => {
  try {
    const kind = String(req.query.kind ?? 'summary');
    if (!Object.hasOwn(exporters, kind)) return res.status(400).json({ message: 'kind must be summary, responses or leaderboard' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Presentation not found' });
    const data = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!data) return res.status(404).json({ message: 'Presentation not found' });
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'presentation';
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-${kind}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(exporters[kind](data));
  } catch (err) {
    return next(err);
  }
});

/**
 * Owner-only JSON report: the same tallies as the live screen and the CSV, for the report view.
 * It is a snapshot of the current results; per-session frozen reports need live sessions (docs/live-sessions.md).
 */
presentationsRouter.get('/:id/report', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Presentation not found' });
    const data = await Presentation.findOne({ _id: req.params.id, owner: req.auth.userId });
    if (!data) return res.status(404).json({ message: 'Presentation not found' });
    const slides = data.slides.map((slide, i) => {
      const tally = tallySlide(slide);
      const base = { index: i, questionType: slide.questionType, question: slide.question };
      if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
        return { ...base, options: slide.options.map((o, k) => ({ text: o.text, count: tally.counts[k], percent: tally.percentages[k] })), total: tally.total, ...(slide.questionType === 'quiz' ? { correctOptionIndex: tally.correctOptionIndex } : {}) };
      }
      if (slide.questionType === 'rating' || slide.questionType === 'ranking' || slide.questionType === 'word-cloud') {
        return { ...base, tally };
      }
      return { ...base, responseCount: slide.responses.length, topResponses: [...slide.responses].sort((a, b) => b.upvotes.length - a.upvotes.length).slice(0, 5).map((r) => ({ text: r.text, upvotes: r.upvotes.length })) };
    });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ data: { title: data.title, generatedAt: new Date().toISOString(), scope: 'current results of this deck (not separated by session)', slides } });
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
      // A deck with no stored slides has nothing to attach identities to, so a
      // first save of brand-new slides (no ids yet) is legitimate. Only reject
      // id-less slides when stored slides exist that they could be mismatched with.
      const echoesNoIdentities =
        presentation.slides.length > 0 && normalized.length > 0 && normalized.every((s) => !s.id);
      if (baseStructureRevision === undefined || echoesNoIdentities) {
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
    const state = publicState(data);
    await broadcastState(data.accessCode, state);
    return res.json({ ok: true, state });
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
