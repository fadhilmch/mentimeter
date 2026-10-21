import { describe, it, expect } from 'vitest';
import { aliasFor, displayName, computeLeaderboard } from '../src/lib/leaderboard.js';
import { applyLiveAction, publicState } from '../src/lib/live.js';

function quizPresentation(overrides = {}) {
  return {
    title: 'Quiz night',
    accessCode: '111111',
    votingOpen: true,
    resultsVisible: true,
    currentSlide: 0,
    participants: [],
    slides: [
      {
        id: 's1',
        questionType: 'quiz',
        question: 'Q1',
        correctOptionId: 'o-b',
        options: [
          { id: 'o-a', text: 'A', votes: ['p-1'] },
          { id: 'o-b', text: 'B', votes: ['p-2', 'p-3'] },
        ],
      },
      {
        id: 's2',
        questionType: 'quiz',
        question: 'Q2',
        correctOptionId: 'o-c',
        options: [
          { id: 'o-c', text: 'C', votes: ['p-2'] },
          { id: 'o-d', text: 'D', votes: ['p-3'] },
        ],
      },
    ],
    ...overrides,
  };
}

describe('participant aliases', () => {
  it('is deterministic per participant id and varies across ids', () => {
    expect(aliasFor('p-abc')).toBe(aliasFor('p-abc'));
    expect(aliasFor('p-abc')).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
    expect(aliasFor('p-abc')).not.toBe(aliasFor('p-xyz'));
  });

  it('prefers a registered nickname and falls back to the alias', () => {
    const p = quizPresentation({ participants: [{ participantId: 'p-1', nickname: 'Fadhil' }] });
    expect(displayName(p, 'p-1')).toBe('Fadhil');
    expect(displayName(p, 'p-2')).toBe(aliasFor('p-2'));
    expect(displayName(quizPresentation({ participants: [{ participantId: 'p-1', nickname: '  ' }] }), 'p-1')).toBe(aliasFor('p-1'));
  });
});

describe('computeLeaderboard', () => {
  it('scores +1 per correct answer across quiz slides', () => {
    const board = computeLeaderboard(quizPresentation());
    expect(board).toEqual([
      { name: aliasFor('p-2'), score: 2, rank: 1 },
      { name: aliasFor('p-3'), score: 1, rank: 2 },
    ]);
    // p-1 answered Q1 wrong and never answered Q2: not on the board.
    expect(board.some((e) => e.name === aliasFor('p-1'))).toBe(false);
  });

  it('shares ranks on ties and skips the next rank', () => {
    const p = quizPresentation();
    p.slides[1].options[1].votes = []; // p-3 loses Q2 answer
    p.slides[1].options[0].votes = ['p-2', 'p-3']; // both correct on Q2
    const board = computeLeaderboard(p);
    expect(board.map((e) => [e.score, e.rank])).toEqual([
      [2, 1],
      [2, 1],
    ]);
  });
});

describe('participant:identify action', () => {
  it('registers, updates and clears nicknames', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'participant:identify', participantId: 'p-1', nickname: 'Fadhil' });
    expect(p.participants).toEqual([{ participantId: 'p-1', nickname: 'Fadhil' }]);
    applyLiveAction(p, { type: 'participant:identify', participantId: 'p-1', nickname: 'Fad' });
    expect(p.participants).toEqual([{ participantId: 'p-1', nickname: 'Fad' }]);
    applyLiveAction(p, { type: 'participant:identify', participantId: 'p-1', nickname: '   ' });
    expect(p.participants).toEqual([]);
  });

  it('is accepted while voting is closed (it is not an answer)', () => {
    const p = quizPresentation({ votingOpen: false });
    expect(() => applyLiveAction(p, { type: 'participant:identify', participantId: 'p-1', nickname: 'Late' })).not.toThrow();
  });
});

describe('quiz answer reveal gating in publicState', () => {
  it('withholds the correct answer and correct count while voting is open', () => {
    const state = publicState(quizPresentation());
    const tally = state.slides[0].tally;
    expect(tally.total).toBe(3);
    expect(tally.counts).toEqual([1, 2]);
    expect('correctOptionIndex' in tally).toBe(false);
    expect('correctCount' in tally).toBe(false);
    expect(state.leaderboard).toBeNull();
  });

  it('reveals answer, correct count and leaderboard once voting is closed', () => {
    const state = publicState(quizPresentation({ votingOpen: false }));
    expect(state.slides[0].tally.correctOptionIndex).toBe(1);
    expect(state.slides[0].tally.correctCount).toBe(2);
    expect(state.leaderboard).toEqual([
      { name: aliasFor('p-2'), score: 2, rank: 1 },
      { name: aliasFor('p-3'), score: 1, rank: 2 },
    ]);
  });

  it('keeps everything hidden while results are hidden, even when closed', () => {
    const state = publicState(quizPresentation({ votingOpen: false, resultsVisible: false }));
    expect(state.slides[0].tally).toBeNull();
    expect(state.leaderboard).toBeNull();
  });

  it('never leaks participant ids or nicknamed identity map', () => {
    const state = publicState(quizPresentation({ votingOpen: false, participants: [{ participantId: 'p-2', nickname: 'Fadhil' }] }));
    const raw = JSON.stringify(state);
    expect(raw).not.toContain('p-2');
    expect(raw).not.toContain('participantId');
    expect(state.leaderboard[0].name).toBe('Fadhil');
  });
});
