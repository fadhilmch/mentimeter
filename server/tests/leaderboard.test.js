import { describe, it, expect } from 'vitest';
import { aliasFor, displayName, computeLeaderboard, playerKey } from '../src/lib/leaderboard.js';
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
    const p = quizPresentation();
    p.slides.forEach((slide) => { slide.revealed = true; });
    const board = computeLeaderboard(p);
    expect(board).toEqual([
      { key: playerKey('111111', 'p-2'), name: aliasFor('p-2'), score: 2, rank: 1 },
      { key: playerKey('111111', 'p-3'), name: aliasFor('p-3'), score: 1, rank: 2 },
      { key: playerKey('111111', 'p-1'), name: aliasFor('p-1'), score: 0, rank: 3 },
    ]);
  });

  it('keeps participants of only unrevealed questions off the board', () => {
    const p = quizPresentation();
    p.slides[0].revealed = true; // Q2 stays sealed
    const board = computeLeaderboard(p);
    expect(board.map((e) => e.name).sort()).toEqual([aliasFor('p-1'), aliasFor('p-2'), aliasFor('p-3')].sort());
    // p-1's wrong Q1 answer counts them in at 0; Q2 (sealed) answers are ignored.
    expect(board.find((e) => e.name === aliasFor('p-1')).score).toBe(0);
    expect(board.find((e) => e.name === aliasFor('p-3')).score).toBe(1);
  });

  it('shares ranks on ties and skips the next rank', () => {
    const p = quizPresentation();
    p.slides.forEach((slide) => { slide.revealed = true; });
    p.slides[1].options[1].votes = []; // p-3 loses Q2 answer
    p.slides[1].options[0].votes = ['p-2', 'p-3']; // both correct on Q2
    const board = computeLeaderboard(p);
    expect(board.map((e) => [e.score, e.rank])).toEqual([
      [2, 1],
      [2, 1],
      [0, 3],
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

  it('reveals presented answers and their scores once voting closes', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false });
    const state = publicState(p);
    // Only the presented question (currentSlide 0) is revealed and scored.
    expect(state.slides[0].tally.correctOptionIndex).toBe(1);
    expect(state.slides[0].tally.correctCount).toBe(2);
    expect(state.leaderboard).toEqual([
      { key: playerKey('111111', 'p-2'), name: aliasFor('p-2'), score: 1, rank: 1 },
      { key: playerKey('111111', 'p-3'), name: aliasFor('p-3'), score: 1, rank: 1 },
      { key: playerKey('111111', 'p-1'), name: aliasFor('p-1'), score: 0, rank: 3 },
    ]);
  });

  it('keeps future quiz answers sealed when voting closes mid-quiz (even when future slides are sent)', () => {
    process.env.PROJECT_FUTURE_SLIDES = 'false';
    try {
      const p = quizPresentation();
      applyLiveAction(p, { type: 'voting:set', open: false });
      const future = publicState(p).slides[1].tally;
      expect('correctOptionIndex' in future).toBe(false);
      expect('correctCount' in future).toBe(false);
    } finally {
      delete process.env.PROJECT_FUTURE_SLIDES;
    }
  });

  it('does not send future slides to phones, only their id and type', () => {
    const p = quizPresentation();
    const state = publicState(p);
    expect(state.slides.length).toBe(p.slides.length);
    expect(state.slides[0].question).not.toBe('');
    expect(state.slides[1]).toEqual({ id: p.slides[1].id, questionType: p.slides[1].questionType, question: '', future: true });
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(publicState(p).slides[1].question).toBe(p.slides[1].question); // revealed on arrival
    expect(publicState(p).slides[0].question).toBe(p.slides[0].question); // past slides stay
  });

  it('freezes a revealed question: votes stay rejected after reopening', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false });
    applyLiveAction(p, { type: 'voting:set', open: true });
    expect(() => applyLiveAction(p, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-1' })).toThrow(
      'This question has already been revealed',
    );
    // Once the presenter moves on, the sealed next question accepts votes normally.
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(() => applyLiveAction(p, { type: 'vote:cast', slideIndex: 1, optionIndex: 0, participantId: 'p-1' })).not.toThrow();
  });

  it('scores only revealed questions as the quiz progresses', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false }); // reveals Q1
    applyLiveAction(p, { type: 'voting:set', open: true });
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    applyLiveAction(p, { type: 'voting:set', open: false }); // reveals Q2
    const state = publicState(p);
    expect(state.leaderboard).toEqual([
      { key: playerKey('111111', 'p-2'), name: aliasFor('p-2'), score: 2, rank: 1 },
      { key: playerKey('111111', 'p-3'), name: aliasFor('p-3'), score: 1, rank: 2 },
      { key: playerKey('111111', 'p-1'), name: aliasFor('p-1'), score: 0, rank: 3 },
    ]);
  });

  it('closing voting does not carry over to the next slide; revealed quizzes stay frozen', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false }); // reveals Q1
    expect(p.votingOpen).toBe(false);
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(p.votingOpen).toBe(true);
    expect(() => applyLiveAction(p, { type: 'vote:cast', slideIndex: 1, optionIndex: 0, participantId: 'p-1' })).not.toThrow();
    // Going back reopens voting generally, but Q1 stays frozen.
    applyLiveAction(p, { type: 'slide:change', slideIndex: 0 });
    expect(() => applyLiveAction(p, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-1' })).toThrow(
      'This question has already been revealed',
    );
  });

  it('re-selecting the current slide leaves a closed vote closed', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false });
    applyLiveAction(p, { type: 'slide:change', slideIndex: p.currentSlide });
    expect(p.votingOpen).toBe(false);
  });

  it('a presenter vote reset un-reveals the question for a fresh round', () => {
    const p = quizPresentation();
    applyLiveAction(p, { type: 'voting:set', open: false });
    applyLiveAction(p, { type: 'vote:reset', slideIndex: 0 });
    applyLiveAction(p, { type: 'voting:set', open: true });
    expect(() => applyLiveAction(p, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-1' })).not.toThrow();
    expect('correctOptionIndex' in publicState(p).slides[0].tally).toBe(false);
  });

  it('keeps everything hidden while results are hidden, even when closed', () => {
    const p = quizPresentation({ resultsVisible: false });
    applyLiveAction(p, { type: 'voting:set', open: false });
    const state = publicState(p);
    expect(state.slides[0].tally).toBeNull();
    expect(state.leaderboard).toBeNull();
  });

  it('never leaks participant ids or nicknamed identity map', () => {
    const p = quizPresentation({ participants: [{ participantId: 'p-2', nickname: 'Fadhil' }] });
    applyLiveAction(p, { type: 'voting:set', open: false });
    const state = publicState(p);
    const raw = JSON.stringify(state);
    expect(raw).not.toContain('p-2');
    expect(raw).not.toContain('participantId');
    expect(state.leaderboard[0].name).toBe('Fadhil');
  });
});

describe('player keys', () => {
  it('are stable, per room, and pinned to a shared vector the client must match', () => {
    expect(playerKey('111111', 'p-1')).toBe('296pve18sa');
    expect(playerKey('111111', 'p-2')).toBe('6pixhw4j56');
    expect(playerKey('222222', 'p-1')).toBe('1ey60bew77n');
  });

  it('tell two players with the same display name apart', () => {
    const p = quizPresentation({
      participants: [
        { participantId: 'p-2', nickname: 'Fika Fan' },
        { participantId: 'p-3', nickname: 'Fika Fan' },
      ],
    });
    p.slides.forEach((slide) => { slide.revealed = true; });
    const board = computeLeaderboard(p);
    const same = board.filter((entry) => entry.name === 'Fika Fan');
    expect(same).toHaveLength(2);
    expect(new Set(same.map((entry) => entry.key)).size).toBe(2);
    expect(same.map((entry) => entry.key)).toContain(playerKey('111111', 'p-3'));
  });

  it('never put a raw participant id in the public board', () => {
    const p = quizPresentation();
    p.slides.forEach((slide) => { slide.revealed = true; });
    expect(JSON.stringify(computeLeaderboard(p))).not.toContain('p-2');
  });
});
