import { tallySlide, isPublicResponse } from './results.js';
import { isLayoutSlide } from '../models/presentation.js';

/** Per-slide report rows from slides (a deck's or a session's). Held (unapproved) responses are counted apart, never listed. */
export function reportSlides(slides) {
  return slides.flatMap((slide, i) => (isLayoutSlide(slide) ? [] : [reportSlide(slide, i)]));
}

function reportSlide(slide, i) {
  const tally = tallySlide(slide);
  const base = { index: i, questionType: slide.questionType, question: slide.question };
  if (slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') {
    return {
      ...base,
      options: slide.options.map((o, k) => ({ text: o.text, count: tally.counts[k], percent: tally.percentages[k] })),
      total: tally.total,
      ...(slide.questionType === 'quiz' ? { correctOptionIndex: tally.correctOptionIndex } : {}),
    };
  }
  if (slide.questionType === 'ranking') {
    return { ...base, tally: { total: tally.total, points: slide.options.map((o, k) => ({ text: o.text, points: tally.points[k] })) } };
  }
  if (slide.questionType === 'rating' || slide.questionType === 'ranking' || slide.questionType === 'word-cloud') {
    return { ...base, tally };
  }
  const shown = slide.responses.filter(isPublicResponse);
  return {
    ...base,
    responseCount: shown.length,
    heldCount: slide.responses.length - shown.length,
    topResponses: [...shown].sort((a, b) => b.upvotes.length - a.upvotes.length).slice(0, 5).map((r) => ({ text: r.text, upvotes: r.upvotes.length })),
  };
}
