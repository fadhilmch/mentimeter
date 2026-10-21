import { describe, it, expect } from 'vitest';
import { castVote, tallySlide, addResponse, toggleUpvote } from '../src/lib/results.js';

const mcSlide = () => ({
  questionType: 'multiple-choice',
  question: 'Best language?',
  options: [
    { text: 'Vue', votes: [] },
    { text: 'React', votes: [] },
  ],
  responses: [],
});

describe('castVote', () => {
  it('records one vote per participant', () => {
    const slide = mcSlide();
    castVote(slide, 0, 'p1');
    castVote(slide, 0, 'p1');
    expect(slide.options[0].votes).toEqual(['p1']);
  });

  it('moves the vote when the participant changes their mind', () => {
    const slide = mcSlide();
    castVote(slide, 0, 'p1');
    castVote(slide, 1, 'p1');
    expect(slide.options[0].votes).toEqual([]);
    expect(slide.options[1].votes).toEqual(['p1']);
  });

  it('rejects out-of-range options and wrong slide types', () => {
    expect(() => castVote(mcSlide(), 5, 'p1')).toThrow(RangeError);
    expect(() => castVote({ questionType: 'open-ended', responses: [] }, 0, 'p1')).toThrow(TypeError);
  });
});

describe('tallySlide', () => {
  it('counts votes and rounds percentages to one decimal', () => {
    const slide = mcSlide();
    castVote(slide, 0, 'p1');
    castVote(slide, 0, 'p2');
    castVote(slide, 1, 'p3');
    expect(tallySlide(slide)).toEqual({ total: 3, counts: [2, 1], percentages: [66.7, 33.3] });
  });

  it('returns zero percentages with no votes', () => {
    expect(tallySlide(mcSlide()).percentages).toEqual([0, 0]);
  });
});

describe('open-ended responses', () => {
  const openSlide = () => ({ questionType: 'open-ended', question: 'Q?', options: [], responses: [] });

  it('adds trimmed responses and rejects empty or oversized text', () => {
    const slide = openSlide();
    addResponse(slide, '  hello  ', 'p1');
    expect(slide.responses[0].text).toBe('hello');
    expect(() => addResponse(slide, '   ', 'p1')).toThrow(TypeError);
    expect(() => addResponse(slide, 'x'.repeat(281), 'p1')).toThrow(RangeError);
  });

  it('toggles upvotes and blocks self-upvotes', () => {
    const slide = openSlide();
    addResponse(slide, 'idea', 'author');
    toggleUpvote(slide, 0, 'fan');
    expect(slide.responses[0].upvotes).toEqual(['fan']);
    toggleUpvote(slide, 0, 'fan');
    expect(slide.responses[0].upvotes).toEqual([]);
    expect(() => toggleUpvote(slide, 0, 'author')).toThrow(TypeError);
    expect(() => toggleUpvote(slide, 9, 'fan')).toThrow(RangeError);
  });
});

describe('resetSlide', () => {
  it('clears multiple-choice votes', async () => {
    const { resetSlide } = await import('../src/lib/results.js');
    const slide = mcSlide();
    castVote(slide, 0, 'p1');
    castVote(slide, 1, 'p2');
    resetSlide(slide);
    expect(slide.options[0].votes).toEqual([]);
    expect(slide.options[1].votes).toEqual([]);
  });

  it('clears open-ended responses', async () => {
    const { resetSlide } = await import('../src/lib/results.js');
    const slide = { questionType: 'open-ended', question: 'Q?', options: [], responses: [] };
    addResponse(slide, 'hello', 'p1');
    resetSlide(slide);
    expect(slide.responses).toEqual([]);
  });
});
