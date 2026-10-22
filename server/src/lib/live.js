import { z } from 'zod';
import { findLiveByCode } from './liveTarget.js';
import { isPublicResponse, castVote, addResponse, submitWord, castRating, submitRanking, toggleUpvote, tallySlide, resetSlide } from './results.js';
import { computeLeaderboard } from './leaderboard.js';
import { LiveError } from './audience.js';

export const liveActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vote:cast'), slideIndex: z.number().int().min(0), optionIndex: z.number().int().min(0), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('response:add'), slideIndex: z.number().int().min(0), text: z.string().max(280), participantId: z.string().min(6).max(64), clientId: z.string().min(8).max(64).optional() }),
  z.object({ type: z.literal('response:upvote'), slideIndex: z.number().int().min(0), responseIndex: z.number().int().min(0).optional(), responseId: z.string().min(1).max(64).optional(), participantId: z.string().min(6).max(64), on: z.boolean().optional() }).refine((a) => a.responseIndex !== undefined || a.responseId !== undefined, { message: 'responseId is required' }),
  z.object({ type: z.literal('word:submit'), slideIndex: z.number().int().min(0), text: z.string().max(40), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('rating:cast'), slideIndex: z.number().int().min(0), value: z.number().int().min(1).max(10), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('ranking:submit'), slideIndex: z.number().int().min(0), order: z.array(z.string().min(1).max(64)).min(2).max(12), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('participant:identify'), participantId: z.string().min(6).max(64), nickname: z.string().max(24) }),
]);

/** Presenter-only actions: accepted on the authenticated route, never on public live channels. */
export const presenterActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('slide:change'), slideIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('vote:reset'), slideIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('voting:set'), open: z.boolean() }),
  z.object({ type: z.literal('results:set'), visible: z.boolean() }),
]);

const newResponseStatus = (presentation) => (presentation.moderationMode === 'approve' ? 'pending' : 'visible');

/** Applies one validated live action to a presentation document. */
export function applyLiveAction(presentation, action) {
  const mutatesAnswers = ['vote:cast', 'response:add', 'response:upvote', 'word:submit', 'rating:cast', 'ranking:submit'].includes(action.type);
  if (mutatesAnswers && presentation.votingOpen === false) {
    throw new TypeError('Voting is closed for this presentation');
  }
  // The presenter paces the session: answers only count for the question on screen. A late or
  // replayed answer for another slide is refused, never applied to a different question.
  if (mutatesAnswers && action.slideIndex !== presentation.currentSlide) {
    throw new LiveError('That question is no longer on screen', 'slide_not_active');
  }
  switch (action.type) {
    case 'vote:reset':
      if (action.slideIndex >= presentation.slides.length) throw new RangeError('Slide index out of range');
      resetSlide(presentation.slides[action.slideIndex]);
      return;
    case 'voting:set':
      presentation.votingOpen = action.open;
      if (!action.open) {
        // Closing voting reveals the presented quiz questions (up to the current
        // slide). Future questions stay sealed: their answers never leave the
        // server and their votes stay changeable on reopen.
        for (let i = 0; i <= presentation.currentSlide && i < presentation.slides.length; i += 1) {
          const slide = presentation.slides[i];
          if (slide.questionType === 'quiz') slide.revealed = true;
        }
      }
      return;
    case 'results:set':
      presentation.resultsVisible = action.visible;
      return;
    case 'participant:identify': {
      const nickname = action.nickname.trim();
      presentation.participants = (presentation.participants ?? []).filter(
        (entry) => entry.participantId !== action.participantId,
      );
      // Empty nickname clears back to the automatic alias.
      if (nickname.length > 0) {
        presentation.participants.push({ participantId: action.participantId, nickname });
      }
      return;
    }
    case 'slide:change':
      if (action.slideIndex >= presentation.slides.length) throw new RangeError('Slide index out of range');
      // Closing voting applies to the question on stage. Moving to a different
      // slide opens it for the new question; revealed quizzes stay frozen
      // through their own `revealed` flag, so going back cannot change answers.
      if (action.slideIndex !== presentation.currentSlide) presentation.votingOpen = true;
      presentation.currentSlide = action.slideIndex;
      return;
    case 'vote:cast': {
      const slide = presentation.slides[action.slideIndex];
      if (slide?.questionType === 'quiz' && slide.revealed) {
        throw new TypeError('This question has already been revealed');
      }
      castVote(presentation.slides[action.slideIndex], action.optionIndex, action.participantId);
      return;
    }
    case 'response:add':
      addResponse(presentation.slides[action.slideIndex], action.text, action.participantId, action.clientId, newResponseStatus(presentation));
      return;
    case 'response:upvote':
      toggleUpvote(presentation.slides[action.slideIndex], action.responseId ?? action.responseIndex, action.participantId, action.on);
      return;
    case 'word:submit':
      submitWord(presentation.slides[action.slideIndex], action.text, action.participantId, newResponseStatus(presentation));
      return;
    case 'rating:cast':
      castRating(presentation.slides[action.slideIndex], action.value, action.participantId);
      return;
    case 'ranking:submit':
      submitRanking(presentation.slides[action.slideIndex], action.order, action.participantId);
      return;
    default:
      throw new TypeError(`Unknown action type: ${action.type}`);
  }
}

/** Quiz tally that withholds the answer while voting is still open. */
function quizTally(slide, _quizRevealed) {
  const tally = tallySlide(slide);
  if (slide.questionType !== 'quiz' || slide.revealed) return tally;
  const { correctOptionIndex, correctCount, ...open } = tally;
  return open;
}

/** Audience-safe snapshot: vote identities and response authors never leave the server.
 *  While the presenter hides results, tallies and responses stay on the server too. */
/**
 * Slides after the one on screen are not sent to phones: only an id and the question type
 * (clients use the type, e.g. to know a deck has a quiz). Question text, options and tallies
 * arrive when the presenter reaches the slide. Set PROJECT_FUTURE_SLIDES=false to send everything,
 * as before. Past slides stay in full.
 */
const futurePlaceholder = (slide) => ({ id: slide.id, questionType: slide.questionType, question: '', future: true });

export function publicState(presentation) {
  const hideFuture = process.env.PROJECT_FUTURE_SLIDES !== 'false';
  const resultsVisible = presentation.resultsVisible !== false;
  // Quiz integrity: the correct answer, correct counts and the leaderboard only
  // leave the server after the presenter closes voting.
  const quizRevealed = presentation.votingOpen === false;
  return {
    id: presentation._id,
    title: presentation.title,
    accessCode: presentation.accessCode,
    theme: presentation.theme,
    revision: presentation.liveRevision ?? 0,
    currentSlide: presentation.currentSlide,
    votingOpen: presentation.votingOpen !== false,
    resultsVisible,
    // Lets the audience say "waiting for approval"; says nothing about any held response.
    moderation: presentation.moderationMode === 'approve' ? 'approve' : 'off',
    // Scores reveal with the answers: only once voting is closed and results are visible.
    leaderboard: quizRevealed && resultsVisible ? computeLeaderboard(presentation) : null,
    slides: presentation.slides.map((slide, index) => (hideFuture && index > presentation.currentSlide ? futurePlaceholder(slide) : {
      id: slide.id,
      questionType: slide.questionType,
      question: slide.question,
      ...(slide.design && (slide.design.accent || slide.design.imageUrl)
        ? {
            design: {
              ...(slide.design.accent ? { accent: slide.design.accent } : {}),
              ...(slide.design.imageUrl ? { imageUrl: slide.design.imageUrl, imageLayout: slide.design.imageLayout ?? 'beside' } : {}),
            },
          }
        : {}),
      ...(slide.questionType === 'multiple-choice' || slide.questionType === 'quiz'
        ? {
            options: slide.options.map(({ text }) => text),
            // Stable ids parallel to options (additive; clients still vote by index).
            optionIds: slide.options.map(({ id }) => id),
            // The correct answer leaves the server only while results are visible,
            // and for quiz slides only after voting closes.
            tally: resultsVisible ? quizTally(slide, quizRevealed) : null,
          }
        : slide.questionType === 'rating' || slide.questionType === 'ranking'
          ? {
              options: slide.questionType === 'ranking' ? slide.options.map(({ id, text }) => ({ id, text })) : undefined,
              tally: resultsVisible ? tallySlide(slide) : null,
            }
          : {
              responses: resultsVisible
                ? slide.responses
                    .map((response, index) => ({ response, index }))
                    .filter(({ response }) => isPublicResponse(response)) // pending, hidden and deleted text never leaves the server
                    .map(({ response: { id, text, upvotes, createdAt }, index }) => ({ ...(id ? { id } : {}), index, text, upvotes: upvotes.length, createdAt })) // index = stored position, the id upvotes address
                    .sort((a, b) => b.upvotes - a.upvotes)
                : [],
              ...(slide.questionType === 'word-cloud' ? { tally: resultsVisible ? tallySlide(slide) : null } : {}),
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
// Actions for one presentation run one after another inside this process. Without it, a few
// hundred simultaneous answers all read the same version, collide, and the unlucky ones exhaust
// their retries and see a raw database error (measured: 40 of 100 and 213 of 250 voters).
// Across several server processes the version check and the retry below still protect the data.
const queues = new Map();
function serialByCode(accessCode, task) {
  const previous = queues.get(accessCode) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => {});
  queues.set(accessCode, tail);
  tail.then(() => { if (queues.get(accessCode) === tail) queues.delete(accessCode); });
  return run;
}

export function applyLiveActionByCode(accessCode, action, options) {
  return serialByCode(accessCode, () => applyLiveActionUnqueued(accessCode, action, options));
}

async function applyLiveActionUnqueued(accessCode, action, { maxAttempts = 8 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Fresh document each attempt: retries re-apply onto the latest state.
    const presentation = await findLiveByCode(accessCode);
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
