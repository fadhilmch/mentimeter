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
