import { z } from 'zod';
import { Presentation } from '../models/presentation.js';
import { castVote, addResponse, submitWord, castRating, submitRanking, toggleUpvote, tallySlide, resetSlide } from './results.js';
import { computeLeaderboard } from './leaderboard.js';

export const liveActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('slide:change'), slideIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('vote:cast'), slideIndex: z.number().int().min(0), optionIndex: z.number().int().min(0), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('response:add'), slideIndex: z.number().int().min(0), text: z.string().max(280), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('response:upvote'), slideIndex: z.number().int().min(0), responseIndex: z.number().int().min(0), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('word:submit'), slideIndex: z.number().int().min(0), text: z.string().max(40), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('rating:cast'), slideIndex: z.number().int().min(0), value: z.number().int().min(1).max(10), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('ranking:submit'), slideIndex: z.number().int().min(0), order: z.array(z.string().min(1).max(64)).min(2).max(12), participantId: z.string().min(6).max(64) }),
  z.object({ type: z.literal('participant:identify'), participantId: z.string().min(6).max(64), nickname: z.string().max(24) }),
]);

/** Presenter-only actions: accepted on the authenticated route, never on public live channels. */
export const presenterActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vote:reset'), slideIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('voting:set'), open: z.boolean() }),
  z.object({ type: z.literal('results:set'), visible: z.boolean() }),
]);

/** Applies one validated live action to a presentation document. */
export function applyLiveAction(presentation, action) {
  const mutatesAnswers = ['vote:cast', 'response:add', 'response:upvote', 'word:submit', 'rating:cast', 'ranking:submit'].includes(action.type);
  if (mutatesAnswers && presentation.votingOpen === false) {
    throw new TypeError('Voting is closed for this presentation');
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
      addResponse(presentation.slides[action.slideIndex], action.text, action.participantId);
      return;
    case 'response:upvote':
      toggleUpvote(presentation.slides[action.slideIndex], action.responseIndex, action.participantId);
      return;
    case 'word:submit':
      submitWord(presentation.slides[action.slideIndex], action.text, action.participantId);
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
export function publicState(presentation) {
  const resultsVisible = presentation.resultsVisible !== false;
  // Quiz integrity: the correct answer, correct counts and the leaderboard only
  // leave the server after the presenter closes voting.
  const quizRevealed = presentation.votingOpen === false;
  return {
    id: presentation._id,
    title: presentation.title,
    accessCode: presentation.accessCode,
    theme: presentation.theme,
    currentSlide: presentation.currentSlide,
    votingOpen: presentation.votingOpen !== false,
    resultsVisible,
    // Scores reveal with the answers: only once voting is closed and results are visible.
    leaderboard: quizRevealed && resultsVisible ? computeLeaderboard(presentation) : null,
    slides: presentation.slides.map((slide) => ({
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
                    .map(({ text, upvotes, createdAt }) => ({ text, upvotes: upvotes.length, createdAt }))
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
