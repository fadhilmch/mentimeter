import { randomUUID } from 'node:crypto';

const envNumber = (name, fallback) => (process.env[name] ? Number(process.env[name]) : fallback);
/** Submission volume caps for open-ended slides. Tunable per deployment; counted per stored response. */
export const responseCaps = () => ({
  perParticipant: envNumber('LIVE_MAX_RESPONSES_PER_PARTICIPANT', 10),
  perSlide: envNumber('LIVE_MAX_RESPONSES_PER_SLIDE', 500),
});

/** Responses the audience may see and that count in tallies and exports. No status means visible. */
export const isPublicResponse = (response) => (response.status ?? 'visible') === 'visible';

/** One vote per participant per slide: casting again moves the vote. */
export function castVote(slide, optionIndex, participantId) {
  if (slide.questionType !== 'multiple-choice' && slide.questionType !== 'quiz') {
    throw new TypeError('Votes only apply to multiple-choice and quiz slides');
  }
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= slide.options.length) {
    throw new RangeError('Option index out of range');
  }
  for (const option of slide.options) {
    option.votes = option.votes.filter((id) => id !== participantId);
  }
  slide.options[optionIndex].votes.push(participantId);
  return slide;
}

export function tallySlide(slide) {
  if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
    const counts = slide.options.map((option) => option.votes.length);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const tally = {
      total,
      counts,
      percentages: counts.map((count) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10)),
    };
    if (slide.questionType === 'quiz') {
      const correctIndex = slide.options.findIndex((option) => option.id && option.id === slide.correctOptionId);
      tally.correctOptionIndex = correctIndex;
      tally.correctCount = correctIndex >= 0 ? counts[correctIndex] : 0;
    }
    return tally;
  }
  if (slide.questionType === 'word-cloud') {
    // Counts per normalized word; the stage sizes words by count.
    // A Map, not an object: words like "constructor" or "__proto__" are valid input.
    const counts = new Map();
    const publicResponses = (slide.responses ?? []).filter(isPublicResponse);
    for (const response of publicResponses) {
      const word = response.text.toLowerCase();
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const words = [...counts]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    return { total: publicResponses.length, words };
  }
  if (slide.questionType === 'rating') {
    const ratings = slide.ratings ?? [];
    const total = ratings.length;
    const sum = ratings.reduce((acc, entry) => acc + entry.value, 0);
    // Buckets 1-10 for the distribution bars.
    const buckets = Array.from({ length: 10 }, (_, index) => ratings.filter((entry) => entry.value === index + 1).length);
    return { total, average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10, buckets };
  }
  if (slide.questionType === 'ranking') {
    // Borda-style points: an option earns (optionCount - position) points per ballot.
    const optionCount = slide.options.length;
    const points = slide.options.map(() => 0);
    for (const ranking of slide.rankings ?? []) {
      ranking.order.forEach((optionId, position) => {
        const index = slide.options.findIndex((option) => option.id === optionId);
        if (index >= 0) points[index] += optionCount - position;
      });
    }
    return { total: slide.rankings?.length ?? 0, points };
  }
  return { total: (slide.responses ?? []).filter(isPublicResponse).length };
}

/** One word per participant on word-cloud slides: submitting again replaces the word. */
export function submitWord(slide, text, participantId, status = 'visible') {
  if (slide.questionType !== 'word-cloud') {
    throw new TypeError('Words only apply to word-cloud slides');
  }
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length === 0) throw new TypeError('Word must not be empty');
  if (cleaned.length > 40) throw new RangeError('A word is limited to 40 characters');
  if (/\s/.test(cleaned)) throw new TypeError('One word only - no spaces');
  slide.responses = (slide.responses ?? []).filter((entry) => entry.authorId !== participantId);
  slide.responses.push({ id: randomUUID(), text: cleaned, upvotes: [], authorId: participantId, status });
  return slide;
}

/** One 1-10 rating per participant: rating again replaces the earlier value. */
export function castRating(slide, value, participantId) {
  if (slide.questionType !== 'rating') {
    throw new TypeError('Ratings only apply to rating slides');
  }
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new RangeError('Rating must be a whole number from 1 to 10');
  }
  slide.ratings = (slide.ratings ?? []).filter((entry) => entry.authorId !== participantId);
  slide.ratings.push({ authorId: participantId, value });
  return slide;
}

/** One full ordering per participant: submitting again replaces the earlier ranking. */
export function submitRanking(slide, order, participantId) {
  if (slide.questionType !== 'ranking') {
    throw new TypeError('Rankings only apply to ranking slides');
  }
  const optionIds = slide.options.map((option) => option.id).filter(Boolean);
  if (optionIds.length < 2) throw new TypeError('Ranking slides need at least 2 options');
  const unique = new Set(order);
  if (order.length !== optionIds.length || unique.size !== optionIds.length || !optionIds.every((id) => unique.has(id))) {
    throw new RangeError('Ranking must order every option exactly once');
  }
  slide.rankings = (slide.rankings ?? []).filter((entry) => entry.authorId !== participantId);
  slide.rankings.push({ authorId: participantId, order: [...order] });
  return slide;
}

/** A retry carrying the same clientId from the same participant is the same answer: stored once. */
export function addResponse(slide, text, participantId, clientId, status = 'visible') {
  if (slide.questionType !== 'open-ended') {
    throw new TypeError('Responses only apply to open-ended slides');
  }
  const cleaned = text.trim();
  if (cleaned.length === 0) throw new TypeError('Response text must not be empty');
  if (cleaned.length > 280) throw new RangeError('Response text is limited to 280 characters');
  if (clientId && slide.responses.some((entry) => entry.authorId === participantId && entry.clientId === clientId)) return slide;
  const caps = responseCaps();
  if (slide.responses.length >= caps.perSlide) throw new RangeError('This question has reached its limit of responses');
  if (slide.responses.filter((entry) => entry.authorId === participantId).length >= caps.perParticipant) {
    throw new RangeError(`You can send up to ${caps.perParticipant} responses to one question`);
  }
  slide.responses.push({ id: randomUUID(), text: cleaned, upvotes: [], authorId: participantId, status, ...(clientId ? { clientId } : {}) });
  return slide;
}

/** `on` states the wanted result (true = upvoted), so a retry cannot undo it. Without `on` it toggles. */
export function toggleUpvote(slide, target, participantId, on) {
  // A string is a stable response id (preferred: it cannot point at a different answer after a reset).
  // A number is the stored position, kept for clients that predate response ids.
  let responseIndex = target;
  if (typeof target === 'string') {
    responseIndex = slide.responses.findIndex((entry) => entry.id === target);
    if (responseIndex === -1) throw new RangeError('Response not found');
  }
  if (!Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= slide.responses.length) {
    throw new RangeError('Response index out of range');
  }
  const response = slide.responses[responseIndex];
  // Pending, hidden and deleted responses cannot be upvoted, and the vote is never moved to another response.
  if (!isPublicResponse(response)) throw new RangeError('Response index out of range');
  if (response.authorId === participantId) {
    throw new TypeError('Authors cannot upvote their own response');
  }
  const at = response.upvotes.indexOf(participantId);
  if (at === -1) {
    if (on !== false) response.upvotes.push(participantId);
  } else if (on !== true) {
    response.upvotes.splice(at, 1);
  }
  return slide;
}

/** Presenter control: clears one slide's collected answers (votes for MC, responses for open-ended). */
export function resetSlide(slide) {
  if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
    for (const option of slide.options) option.votes = [];
    slide.revealed = false;
    slide.answerTimes = [];
  } else if (slide.questionType === 'rating') {
    slide.ratings = [];
  } else if (slide.questionType === 'ranking') {
    slide.rankings = [];
  } else {
    slide.responses = [];
  }
  return slide;
}
