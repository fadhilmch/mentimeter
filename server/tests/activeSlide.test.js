import { describe, expect, it } from 'vitest';
import { applyLiveAction } from '../src/lib/live.js';

function deck() {
  const slide = (type) => ({
    id: `s-${type}`, questionType: type, question: 'Q', responses: [], ratings: [], rankings: [],
    options: [{ id: 'a', text: 'A', votes: [] }, { id: 'b', text: 'B', votes: [] }],
  });
  return { accessCode: '123456', currentSlide: 0, votingOpen: true, participants: [], slides: [slide('multiple-choice'), slide('multiple-choice'), { ...slide('open-ended'), options: [] }] };
}
const vote = (slideIndex, optionIndex = 0) => ({ type: 'vote:cast', slideIndex, optionIndex, participantId: 'person-1' });

describe('answers only count for the question on screen', () => {
  it('accepts an answer for the current slide', () => {
    const p = deck();
    applyLiveAction(p, vote(0));
    expect(p.slides[0].options[0].votes).toEqual(['person-1']);
  });

  it('refuses a future-slide answer and changes nothing', () => {
    const p = deck();
    expect(() => applyLiveAction(p, vote(1))).toThrow('no longer on screen');
    expect(p.slides[1].options[0].votes).toEqual([]);
  });

  it('refuses a late answer for a past slide after the presenter moved on', () => {
    const p = deck();
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(() => applyLiveAction(p, vote(0))).toThrow('no longer on screen');
    expect(p.slides[0].options[0].votes).toEqual([]);
    applyLiveAction(p, vote(1));
    expect(p.slides[1].options[0].votes).toEqual(['person-1']);
  });

  it('applies to every answer type, not only votes', () => {
    const p = deck();
    expect(() => applyLiveAction(p, { type: 'response:add', slideIndex: 2, text: 'hi', participantId: 'person-1' })).toThrow('no longer on screen');
    expect(() => applyLiveAction(p, { type: 'rating:cast', slideIndex: 2, value: 5, participantId: 'person-1' })).toThrow('no longer on screen');
    expect(() => applyLiveAction(p, { type: 'word:submit', slideIndex: 2, text: 'w', participantId: 'person-1' })).toThrow('no longer on screen');
  });

  it('still lets a nickname change at any time', () => {
    const p = deck();
    expect(() => applyLiveAction(p, { type: 'participant:identify', participantId: 'person-1', nickname: 'Fika Fan' })).not.toThrow();
  });
});
