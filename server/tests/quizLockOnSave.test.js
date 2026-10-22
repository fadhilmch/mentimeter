import { describe, expect, it } from 'vitest';
import { matchSlideUpdate } from '../src/lib/slideIdentity.js';

const stored = (revealed = true) => [{
  id: 's1', questionType: 'quiz', question: 'Closest planet?', revealed, correctOptionId: 'o1',
  options: [{ id: 'o1', text: 'Mercury', votes: ['p1', 'p2'] }, { id: 'o2', text: 'Venus', votes: ['p3'] }],
  responses: [], ratings: [], rankings: [],
}];
const incoming = (over = {}, options) => [{
  id: 's1', questionType: 'quiz', question: 'Closest planet?', correctOptionId: 'o1',
  options: options ?? [{ id: 'o1', text: 'Mercury' }, { id: 'o2', text: 'Venus' }], ...over,
}];

describe('saving a revealed quiz', () => {
  it('keeps the lock and the votes when nothing about the question changed', () => {
    const { merged, removedVotes } = matchSlideUpdate(stored(), incoming({ design: { accent: '#fff' } }));
    expect(merged[0].revealed).toBe(true);
    expect(merged[0].options[0].votes).toEqual(['p1', 'p2']);
    expect(removedVotes).toBe(0);
  });

  it('keeps the lock when options are only reordered by stable id', () => {
    const { merged } = matchSlideUpdate(stored(), incoming({}, [{ id: 'o2', text: 'Venus' }, { id: 'o1', text: 'Mercury' }]));
    expect(merged[0].revealed).toBe(true);
    expect(merged[0].options.find((o) => o.id === 'o1').votes).toEqual(['p1', 'p2']);
  });

  it.each([
    ['the question text', { question: 'Which planet is nearest?' }, undefined],
    ['the answer key', { correctOptionId: 'o2' }, undefined],
    ['an option text', {}, [{ id: 'o1', text: 'Mercury!' }, { id: 'o2', text: 'Venus' }]],
    ['a removed option', {}, [{ id: 'o1', text: 'Mercury' }]],
  ])('changing %s drops the answers, unlocks, and counts them so the save asks to confirm', (_name, over, options) => {
    const { merged, removedVotes } = matchSlideUpdate(stored(), incoming(over, options));
    expect(merged[0].revealed).toBeUndefined();
    expect(merged[0].options.every((o) => o.votes.length === 0)).toBe(true);
    expect(removedVotes).toBe(3);
  });

  it('an unrevealed quiz still keeps its votes when its text is edited (unchanged behaviour)', () => {
    const { merged, removedVotes } = matchSlideUpdate(stored(false), incoming({ question: 'Nearest planet?' }));
    expect(merged[0].options[0].votes).toEqual(['p1', 'p2']);
    expect(removedVotes).toBe(0);
  });
});
