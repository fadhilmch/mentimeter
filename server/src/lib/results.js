/** One vote per participant per slide: casting again moves the vote. */
export function castVote(slide, optionIndex, participantId) {
  if (slide.questionType !== 'multiple-choice') {
    throw new TypeError('Votes only apply to multiple-choice slides');
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
  if (slide.questionType !== 'multiple-choice') {
    return { total: slide.responses?.length ?? 0 };
  }
  const counts = slide.options.map((option) => option.votes.length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return {
    total,
    counts,
    percentages: counts.map((count) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10)),
  };
}

export function addResponse(slide, text, participantId) {
  if (slide.questionType !== 'open-ended') {
    throw new TypeError('Responses only apply to open-ended slides');
  }
  const cleaned = text.trim();
  if (cleaned.length === 0) throw new TypeError('Response text must not be empty');
  if (cleaned.length > 280) throw new RangeError('Response text is limited to 280 characters');
  slide.responses.push({ text: cleaned, upvotes: [], authorId: participantId });
  return slide;
}

export function toggleUpvote(slide, responseIndex, participantId) {
  if (!Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= slide.responses.length) {
    throw new RangeError('Response index out of range');
  }
  const response = slide.responses[responseIndex];
  if (response.authorId === participantId) {
    throw new TypeError('Authors cannot upvote their own response');
  }
  const at = response.upvotes.indexOf(participantId);
  if (at === -1) response.upvotes.push(participantId);
  else response.upvotes.splice(at, 1);
  return slide;
}

/** Presenter control: clears one slide's collected answers (votes for MC, responses for open-ended). */
export function resetSlide(slide) {
  if (slide.questionType === 'multiple-choice') {
    for (const option of slide.options) option.votes = [];
  } else {
    slide.responses = [];
  }
  return slide;
}
