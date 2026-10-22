import { describe, expect, it } from 'vitest';
import { applyLiveAction, publicState } from '../src/lib/live.js';

function deck() {
  return {
    accessCode: '123456',
    currentSlide: 0,
    votingOpen: true,
    resultsVisible: true,
    participants: [],
    slides: [
      {
        questionType: 'open-ended',
        question: 'Ideas?',
        options: [],
        responses: [
          { text: 'A', authorId: 'author-a', upvotes: [] },
          { text: 'B', authorId: 'author-b', upvotes: ['fan-1'] },
        ],
      },
    ],
  };
}

describe('comment upvotes after the public list is sorted', () => {
  it('each public comment carries its stored position, so a sorted list upvotes the right one', () => {
    const presentation = deck();
    const shown = publicState(presentation).slides[0].responses;
    expect(shown.map((r) => r.text)).toEqual(['B', 'A']); // B has more upvotes, so it is listed first
    const clickedB = shown[0]; // the phone shows B on top and sends what the card says
    applyLiveAction(presentation, { type: 'response:upvote', slideIndex: 0, responseIndex: clickedB.index, participantId: 'fan-2', on: true });
    expect(presentation.slides[0].responses[1].upvotes).toEqual(['fan-1', 'fan-2']); // B
    expect(presentation.slides[0].responses[0].upvotes).toEqual([]); // A untouched
  });
});

describe('comment upvotes addressed by stable response id', () => {
  const build = () => ({
    accessCode: '123456', currentSlide: 0, votingOpen: true, resultsVisible: true, participants: [],
    slides: [{ questionType: 'open-ended', question: 'q', responses: [
      { id: 'id-a', text: 'A', authorId: 'author-a', upvotes: [] },
      { id: 'id-b', text: 'B', authorId: 'author-b', upvotes: ['fan-1'] },
    ] }],
  });
  it('public state carries ids and an id upvote changes only that response', () => {
    const presentation = build();
    const shown = publicState(presentation).slides[0].responses;
    expect(shown.map((r) => r.id)).toEqual(['id-b', 'id-a']);
    applyLiveAction(presentation, { type: 'response:upvote', slideIndex: 0, responseId: 'id-a', participantId: 'fan-2', on: true });
    expect(presentation.slides[0].responses[0].upvotes).toEqual(['fan-2']);
    expect(presentation.slides[0].responses[1].upvotes).toEqual(['fan-1']);
  });
  it('an unknown id is rejected and never lands on another response', () => {
    const presentation = build();
    expect(() => applyLiveAction(presentation, { type: 'response:upvote', slideIndex: 0, responseId: 'gone', participantId: 'fan-2', on: true })).toThrow();
    expect(presentation.slides[0].responses.map((r) => r.upvotes.length)).toEqual([0, 1]);
  });
  it('an old client that sends a position still works', () => {
    const presentation = build();
    applyLiveAction(presentation, { type: 'response:upvote', slideIndex: 0, responseIndex: 0, participantId: 'fan-2', on: true });
    expect(presentation.slides[0].responses[0].upvotes).toEqual(['fan-2']);
  });
});

describe('what a cached older client can still rely on', () => {
  it('keeps every field an older client reads for the slide on screen, and the slide count', () => {
    const presentation = deck();
    presentation.slides.push({ id: 's2', questionType: 'multiple-choice', question: 'Secret next', options: [{ id: 'o1', text: 'x', votes: [] }], responses: [] });
    const state = publicState(presentation);
    expect(state.slides).toHaveLength(2); // slide counts and "slide N of M" keep working
    expect(state.slides[0].question).toBe('Ideas?');
    expect(state.slides[0].responses.every((r) => typeof r.index === 'number' && typeof r.text === 'string' && typeof r.upvotes === 'number')).toBe(true);
    expect(state.slides[1].questionType).toBe('multiple-choice'); // clients use the type to know a deck has a quiz
    expect(JSON.stringify(state.slides[1])).not.toContain('Secret next');
  });
});
