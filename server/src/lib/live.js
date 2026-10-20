import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { castVote, addResponse, toggleUpvote, tallySlide } from './results.js';

export const liveActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('slide:change'), slideIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('vote:cast'), slideIndex: z.number().int().min(0), optionIndex: z.number().int().min(0), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('response:add'), slideIndex: z.number().int().min(0), text: z.string().max(280), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('response:upvote'), slideIndex: z.number().int().min(0), responseIndex: z.number().int().min(0), participantId: z.string().min(6).max(64) }),
]);

/** Applies one validated live action to a presentation document. */
export function applyLiveAction(presentation, action) {
  switch (action.type) {
    case 'slide:change':
      if (action.slideIndex >= presentation.slides.length) throw new RangeError('Slide index out of range');
      presentation.currentSlide = action.slideIndex;
      return;
    case 'vote:cast':
      castVote(presentation.slides[action.slideIndex], action.optionIndex, action.participantId);
      return;
    case 'response:add':
      addResponse(presentation.slides[action.slideIndex], action.text, action.participantId);
      return;
    case 'response:upvote':
      toggleUpvote(presentation.slides[action.slideIndex], action.responseIndex, action.participantId);
      return;
    default:
      throw new TypeError(`Unknown action type: ${action.type}`);
  }
}

/** Audience-safe snapshot: vote identities and response authors never leave the server. */
export function publicState(presentation) {
  return {
    id: presentation._id,
    title: presentation.title,
    accessCode: presentation.accessCode,
    currentSlide: presentation.currentSlide,
    slides: presentation.slides.map((slide) => ({
      questionType: slide.questionType,
      question: slide.question,
      ...(slide.questionType === 'multiple-choice'
        ? { options: slide.options.map(({ text }) => text), tally: tallySlide(slide) }
        : {
            responses: slide.responses
              .map(({ text, upvotes, createdAt }) => ({ text, upvotes: upvotes.length, createdAt }))
              .sort((a, b) => b.upvotes - a.upvotes),
          }),
    })),
  };
}

export const liveChannel = (accessCode) => `presentation:${accessCode}`;

/**
 * Loads a presentation by join code and applies one validated action, retrying
 * on Mongoose optimistic-concurrency conflicts so concurrent audience actions
 * (many people voting at once) do not fail or drop votes.
 */
export async function applyLiveActionByCode(accessCode, action, { maxAttempts = 8 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Fresh document each attempt: retries re-apply onto the latest state.
    const presentation = await Presentation.findOne({ accessCode });
    if (!presentation) return null;
    try {
      applyLiveAction(presentation, action);
      await presentation.save();
      return presentation;
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === maxAttempts - 1) throw err;
      // Jittered backoff: concurrent audience actions spread out instead of colliding again.
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30 * (attempt + 1)));
    }
  }
  return null; // unreachable
}
