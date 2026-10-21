import { describe, it, expect } from 'vitest';
import { ensureSlideIds, hasUnidentifiedSlides, matchSlideUpdate } from '../src/lib/slideIdentity.js';

const slide = (id, question, options, responses = []) => ({
  id, questionType: 'multiple-choice', question, responses,
  options: options.map(([id, text, votes]) => ({ id, text, votes: votes ?? [] })),
});

describe('slideIdentity', () => {
  it('stamps ids only where missing', () => {
    const p = { slides: [slide('s1', 'Q?', [['o1', 'a'], [undefined, 'b']])] };
    expect(ensureSlideIds(p)).toBe(true);
    expect(p.slides[0].id).toBe('s1');
    expect(p.slides[0].options[0].id).toBe('o1');
    expect(p.slides[0].options[1].id).toEqual(expect.any(String));
    expect(ensureSlideIds(p)).toBe(false);
    expect(hasUnidentifiedSlides(p.slides)).toBe(false);
    expect(hasUnidentifiedSlides([{ id: undefined, options: [] }])).toBe(true);
  });

  it('keeps votes attached across slide reorder', () => {
    const stored = [slide('s1', 'One?', [['o1', 'a', ['v1']]]), slide('s2', 'Two?', [['o2', 'a', ['v2']]])];
    const incoming = [
      { id: 's2', questionType: 'multiple-choice', question: 'Two?', options: [{ id: 'o2', text: 'a' }] },
      { id: 's1', questionType: 'multiple-choice', question: 'One?', options: [{ id: 'o1', text: 'a' }] },
    ];
    const { merged, removedVotes, removedResponses } = matchSlideUpdate(stored, incoming);
    expect(merged[0].id).toBe('s2');
    expect(merged[0].options[0].votes).toEqual(['v2']);
    expect(merged[1].options[0].votes).toEqual(['v1']);
    expect(removedVotes).toBe(0);
    expect(removedResponses).toBe(0);
  });

  it('counts votes on removed slides and options, keeps matched ones', () => {
    const stored = [slide('s1', 'One?', [['o1', 'a', ['v1', 'v2']], ['o2', 'b', ['v3']]])];
    const incoming = [{ id: 's1', questionType: 'multiple-choice', question: 'One?', options: [{ id: 'o2', text: 'b' }] }];
    const { merged, removedVotes } = matchSlideUpdate(stored, incoming);
    expect(merged[0].options[0].votes).toEqual(['v3']);
    expect(removedVotes).toBe(2);
  });

  it('discards and counts results when a slide changes type', () => {
    const stored = [{ ...slide('s1', 'One?', []), questionType: 'open-ended', responses: [{ text: 'r', authorId: 'a', upvotes: [] }] }];
    const incoming = [{ id: 's1', questionType: 'multiple-choice', question: 'One?', options: [{ text: 'a' }, { text: 'b' }] }];
    const first = matchSlideUpdate(stored, incoming);
    expect(first.merged[0].id).toBe('s1');
    expect(first.merged[0].responses).toEqual([]);
    expect(first.removedVotes).toBe(0);
    expect(first.removedResponses).toBe(1);

    const back = matchSlideUpdate(first.merged, [{ id: 's1', questionType: 'open-ended', question: 'One?', options: [] }]);
    expect(back.merged[0].options).toEqual([]);
    expect(back.removedVotes).toBe(0);
    expect(back.removedResponses).toBe(0);
  });

  it('treats unidentified incoming slides as new and never copies votes onto them', () => {
    const stored = [slide('s1', 'One?', [['o1', 'a', ['v1']]])];
    const incoming = [{ questionType: 'multiple-choice', question: 'One?', options: [{ text: 'a' }] }];
    const { merged, removedVotes } = matchSlideUpdate(stored, incoming);
    expect(merged[0].id).not.toBe('s1');
    expect(merged[0].options[0].votes).toEqual([]);
    expect(removedVotes).toBe(1);
  });
});

describe('quiz correctOptionId remap', () => {
  const quizSlide = (id, options, correctOptionId) => ({
    id,
    questionType: 'quiz',
    question: 'Q?',
    correctOptionId,
    responses: [],
    ratings: [],
    rankings: [],
    options: options.map(([oid, text, votes]) => ({ id: oid, text, votes: votes ?? [] })),
  });

  it('keeps the key on an existing option id', () => {
    const stored = [quizSlide('s1', [['o1', 'a', ['v1']], ['o2', 'b']], 'o2')];
    const incoming = [{ id: 's1', questionType: 'quiz', question: 'Q?', correctOptionId: 'o2', options: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }] }];
    const { merged } = matchSlideUpdate(stored, incoming);
    expect(merged[0].correctOptionId).toBe('o2');
    expect(merged[0].options[0].votes).toEqual(['v1']);
  });

  it('remaps a key pointing at a newly added option by position', () => {
    const stored = [quizSlide('s1', [['o1', 'a']], undefined)];
    const incoming = [{ id: 's1', questionType: 'quiz', question: 'Q?', correctOptionId: 'client-temp-id', options: [{ id: 'o1', text: 'a' }, { id: 'client-temp-id', text: 'b' }] }];
    const { merged } = matchSlideUpdate(stored, incoming);
    expect(merged[0].correctOptionId).toBe(merged[0].options[1].id);
    expect(merged[0].correctOptionId).not.toBe('client-temp-id');
  });

  it('drops a dangling key that matches no incoming option', () => {
    const stored = [quizSlide('s1', [['o1', 'a']], 'o1')];
    const incoming = [{ id: 's1', questionType: 'quiz', question: 'Q?', correctOptionId: 'ghost', options: [{ id: 'o1', text: 'a' }] }];
    const { merged } = matchSlideUpdate(stored, incoming);
    expect(merged[0].correctOptionId).toBeUndefined();
  });
});
