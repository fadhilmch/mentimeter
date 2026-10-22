import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Presentation } from '../models/presentation.js';

const LOG_LIMIT = 200;

export const moderationActionSchema = z.object({ action: z.enum(['approve', 'hide', 'restore', 'delete']) });
export const moderationModeSchema = z.object({ mode: z.enum(['off', 'approve']) });

/**
 * Allowed moves. approve: pending -> visible. hide: visible or pending -> hidden (reversible).
 * restore: hidden -> visible. delete: any state -> deleted, which clears the text for good.
 * Repeating an action that already holds is a no-op, so a double click or retry is safe.
 */
const NEXT = {
  approve: { from: ['pending'], to: 'visible' },
  hide: { from: ['visible', 'pending'], to: 'hidden' },
  restore: { from: ['hidden'], to: 'visible' },
  delete: { from: ['visible', 'pending', 'hidden'], to: 'deleted' },
};

export class ModerationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Older responses were stored without an id. Give each one a stable id the first time moderation looks. */
function stampIds(presentation) {
  let changed = false;
  for (const slide of presentation.slides) {
    for (const response of slide.responses ?? []) {
      if (!response.id) {
        response.id = randomUUID();
        changed = true;
      }
    }
  }
  return changed;
}

const moderated = (slide) => slide.questionType === 'open-ended' || slide.questionType === 'word-cloud';

function log(presentation, entry) {
  presentation.moderationLog.push({ ...entry, at: new Date() });
  if (presentation.moderationLog.length > LOG_LIMIT) {
    presentation.moderationLog.splice(0, presentation.moderationLog.length - LOG_LIMIT);
  }
}

/** Owner-only view of what needs a decision. Text is returned here and nowhere else. */
export function moderationQueue(presentation) {
  const items = [];
  presentation.slides.forEach((slide, slideIndex) => {
    if (!moderated(slide)) return;
    for (const response of slide.responses ?? []) {
      const status = response.status ?? 'visible';
      if (status === 'pending' || status === 'hidden') {
        items.push({ slideId: slide.id, slideIndex, question: slide.question, id: response.id, status, text: response.text, createdAt: response.createdAt });
      }
    }
  });
  return { mode: presentation.moderationMode ?? 'off', items, log: presentation.moderationLog.map(({ action, at }) => ({ action, at })).slice(-20) };
}

/**
 * Loads the owner's presentation, applies `mutate`, and saves, retrying on a version conflict.
 * The change runs against the latest stored state each attempt, so a moderation action racing
 * with an upvote or a duplicate submit can neither undo a delete nor touch a different response.
 */
async function withOwnedPresentation(presentationId, ownerId, mutate, maxAttempts = 6) {
  if (!mongoose.isValidObjectId(presentationId)) throw new ModerationError('Presentation not found', 404);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const presentation = await Presentation.findOne({ _id: presentationId, owner: ownerId });
    if (!presentation) throw new ModerationError('Presentation not found', 404);
    const idsStamped = stampIds(presentation);
    const result = mutate(presentation);
    try {
      if (idsStamped || presentation.isModified()) await presentation.save();
      return { presentation, result };
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new ModerationError('Could not apply the change, try again', 409);
}

export async function loadModerationQueue(presentationId, ownerId) {
  const { presentation } = await withOwnedPresentation(presentationId, ownerId, () => null);
  return moderationQueue(presentation);
}

export async function setModerationMode(presentationId, ownerId, mode) {
  return withOwnedPresentation(presentationId, ownerId, (presentation) => {
    if ((presentation.moderationMode ?? 'off') === mode) return;
    presentation.moderationMode = mode;
    log(presentation, { owner: String(ownerId), action: `mode:${mode}` });
  });
}

export async function moderateResponse(presentationId, ownerId, { slideId, responseId, action }) {
  const rule = NEXT[action];
  return withOwnedPresentation(presentationId, ownerId, (presentation) => {
    const slide = presentation.slides.find((entry) => entry.id === slideId);
    if (!slide || !moderated(slide)) throw new ModerationError('Slide not found', 404);
    const response = (slide.responses ?? []).find((entry) => entry.id === responseId);
    if (!response) throw new ModerationError('Response not found', 404);
    const status = response.status ?? 'visible';
    if (status === rule.to) return; // already there
    if (!rule.from.includes(status)) throw new ModerationError(`A ${status} response cannot be ${action}d`, 409);
    response.status = rule.to;
    if (rule.to === 'deleted') {
      // The slot stays so stored positions never shift, but the text and upvotes are gone.
      response.text = '';
      response.upvotes = [];
    }
    log(presentation, { owner: String(ownerId), action, slideId, responseId });
  });
}
