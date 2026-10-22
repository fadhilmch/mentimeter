/**
 * What one participant has already answered, per slide index. Lets a returning
 * audience member (page refresh, reconnect) see their own selection again.
 * Only the caller's own answers are returned, never anyone else's.
 */
export function answersFor(presentation, participantId) {
  const answers = {};
  presentation.slides.forEach((slide, index) => {
    const mine = {};
    if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
      const vote = slide.options.findIndex((option) => (option.votes ?? []).includes(participantId));
      if (vote >= 0) mine.vote = vote;
    } else if (slide.questionType === 'rating') {
      const rating = (slide.ratings ?? []).find((entry) => entry.authorId === participantId);
      if (rating) mine.rating = rating.value;
    } else if (slide.questionType === 'word-cloud') {
      // A participant sees their own word again unless a presenter hid or deleted it. A word
      // still waiting for approval is returned flagged, so the client does not ask them to resend.
      const word = (slide.responses ?? []).find((entry) => entry.authorId === participantId && ['visible', 'pending', undefined].includes(entry.status));
      if (word) {
        mine.word = word.text;
        if (word.status === 'pending') mine.pending = true;
      }
    } else if (slide.questionType === 'ranking') {
      const ranking = (slide.rankings ?? []).find((entry) => entry.authorId === participantId);
      if (ranking) mine.ranking = [...ranking.order];
    } else if (slide.questionType === 'open-ended') {
      const upvoted = (slide.responses ?? []).flatMap((entry, i) => ((entry.upvotes ?? []).includes(participantId) && (entry.status ?? 'visible') === 'visible' ? [i] : []));
      if (upvoted.length) mine.upvotes = upvoted;
      const upvotedIds = (slide.responses ?? []).flatMap((entry) => (entry.id && (entry.upvotes ?? []).includes(participantId) && (entry.status ?? 'visible') === 'visible' ? [entry.id] : []));
      if (upvotedIds.length) mine.upvoteIds = upvotedIds;
    }
    if (Object.keys(mine).length) answers[index] = mine;
  });
  return answers;
}
