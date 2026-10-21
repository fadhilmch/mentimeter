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
      const word = (slide.responses ?? []).find((entry) => entry.authorId === participantId);
      if (word) mine.word = word.text;
    } else if (slide.questionType === 'ranking') {
      const ranking = (slide.rankings ?? []).find((entry) => entry.authorId === participantId);
      if (ranking) mine.ranking = [...ranking.order];
    } else if (slide.questionType === 'open-ended') {
      const upvoted = (slide.responses ?? []).flatMap((entry, i) => ((entry.upvotes ?? []).includes(participantId) ? [i] : []));
      if (upvoted.length) mine.upvotes = upvoted;
    }
    if (Object.keys(mine).length) answers[index] = mine;
  });
  return answers;
}
