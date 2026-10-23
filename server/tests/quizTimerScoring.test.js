import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLiveAction, publicState } from '../src/lib/live.js';
import { computeLeaderboard } from '../src/lib/leaderboard.js';
import { pointsForCorrect, SPEED_MAX, SPEED_MIN } from '../src/lib/scoring.js';

const quiz = (overrides = {}) => ({
  id: 's1', questionType: 'quiz', question: 'Q', correctOptionId: 'b', responses: [], ratings: [], rankings: [], answerTimes: [],
  options: [{ id: 'a', text: 'A', votes: [] }, { id: 'b', text: 'B', votes: [] }],
  ...overrides,
});
const deck = (slides, overrides = {}) => ({
  accessCode: '123456', currentSlide: 0, votingOpen: true, resultsVisible: true, participants: [], slides, ...overrides,
});
const vote = (participantId, optionIndex, slideIndex = 0) => ({ type: 'vote:cast', slideIndex, optionIndex, participantId });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('question timer', () => {
  it('refuses answers until the presenter starts a timed question', () => {
    const p = deck([quiz({ timeLimit: 20 })]);
    expect(() => applyLiveAction(p, vote('player-1', 1))).toThrow('timer has not started');
    applyLiveAction(p, { type: 'timer:start' });
    applyLiveAction(p, vote('player-1', 1));
    expect(p.slides[0].options[1].votes).toEqual(['player-1']);
  });

  it('refuses answers after the deadline, with a short grace for network delay', () => {
    const p = deck([quiz({ timeLimit: 20 })]);
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(21_000); // inside the 1.5 s grace
    applyLiveAction(p, vote('player-1', 1));
    vi.advanceTimersByTime(1_000);
    expect(() => applyLiveAction(p, vote('player-2', 1))).toThrow('Time is up');
    expect(p.slides[0].options[1].votes).toEqual(['player-1']);
  });

  it('an untimed quiz question has no deadline', () => {
    const p = deck([quiz()]);
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(10 * 60_000);
    applyLiveAction(p, vote('player-1', 1));
    expect(p.slides[0].options[1].votes).toEqual(['player-1']);
  });

  it('moving to a timed question starts its clock; leaving clears it', () => {
    const p = deck([quiz(), quiz({ id: 's2', timeLimit: 10 }), { id: 's3', questionType: 'title', question: 'Done', options: [] }]);
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(p.questionStartedAt).toBeInstanceOf(Date);
    applyLiveAction(p, vote('player-1', 1, 1));
    applyLiveAction(p, { type: 'slide:change', slideIndex: 2 });
    expect(p.questionStartedAt).toBeUndefined();
  });

  it('only quiz questions can be timed', () => {
    const p = deck([{ id: 's', questionType: 'rating', question: 'Q', options: [], ratings: [], responses: [], rankings: [] }]);
    expect(() => applyLiveAction(p, { type: 'timer:start' })).toThrow('Only quiz');
  });

  it('publishes the countdown to the audience without leaking answer times', () => {
    const p = deck([quiz({ timeLimit: 30 })]);
    applyLiveAction(p, { type: 'timer:start' });
    applyLiveAction(p, vote('player-1', 1));
    const state = publicState(p);
    expect(state.timer).toMatchObject({ durationSec: 30, endsAt: Date.now() + 30_000, serverNow: Date.now() });
    expect(JSON.stringify(state)).not.toContain('answerTimes');
    expect(JSON.stringify(state)).not.toContain('player-1');
  });
});

describe('speed scoring', () => {
  it('standard scoring is one point per correct answer, however slow', () => {
    expect(pointsForCorrect('standard', { timeLimit: 20 }, 19_000)).toBe(1);
    expect(pointsForCorrect(undefined, {}, undefined)).toBe(1);
  });

  it('scores between the maximum and the minimum by how fast the answer came', () => {
    const slide = { timeLimit: 20 };
    expect(pointsForCorrect('speed', slide, 0)).toBe(SPEED_MAX);
    expect(pointsForCorrect('speed', slide, 10_000)).toBe(750);
    expect(pointsForCorrect('speed', slide, 20_000)).toBe(SPEED_MIN);
    expect(pointsForCorrect('speed', slide, 99_000)).toBe(SPEED_MIN);
    expect(pointsForCorrect('speed', slide, undefined)).toBe(SPEED_MIN);
  });

  it('an untimed question is scored over a 30 second window', () => {
    expect(pointsForCorrect('speed', {}, 15_000)).toBe(750);
  });

  it('ranks the faster correct player first and gives a wrong answer nothing', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(2_000);
    applyLiveAction(p, vote('fast-player', 1));
    vi.advanceTimersByTime(14_000);
    applyLiveAction(p, vote('slow-player', 1));
    applyLiveAction(p, vote('wrong-player', 0));
    applyLiveAction(p, { type: 'voting:set', open: false });
    const board = computeLeaderboard(p);
    expect(board.map((e) => [e.rank, e.score])).toEqual([[1, 950], [2, 600], [3, 0]]);
  });

  it('counts the latest answer time when a player changes their answer', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'timer:start' });
    applyLiveAction(p, vote('player-1', 0));
    vi.advanceTimersByTime(10_000);
    applyLiveAction(p, vote('player-1', 1));
    applyLiveAction(p, { type: 'voting:set', open: false });
    expect(computeLeaderboard(p)[0].score).toBe(750);
  });

  it('standard decks keep whole points and reset clears the timing', () => {
    const p = deck([quiz()]);
    applyLiveAction(p, { type: 'timer:start' });
    applyLiveAction(p, vote('player-1', 1));
    applyLiveAction(p, { type: 'voting:set', open: false });
    expect(computeLeaderboard(p)[0].score).toBe(1);
    expect(publicState(p).quizScoring).toBe('standard');
    applyLiveAction(p, { type: 'vote:reset', slideIndex: 0 });
    expect(p.slides[0].answerTimes).toEqual([]);
  });
});

describe('fairness and edge cases', () => {
  it('re-picking the same answer never makes it earlier, and a late change is refused', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(5_000);
    applyLiveAction(p, vote('player-1', 1));
    vi.advanceTimersByTime(5_000);
    applyLiveAction(p, vote('player-1', 1));
    expect(p.slides[0].answerTimes.find((e) => e.participantId === 'player-1').ms).toBe(10_000);
    vi.advanceTimersByTime(20_000);
    expect(() => applyLiveAction(p, vote('player-1', 0))).toThrow(/time/i);
    expect(p.slides[0].answerTimes.find((e) => e.participantId === 'player-1').ms).toBe(10_000);
  });

  it('answer time comes from the server clock, not from the request', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(4_000);
    applyLiveAction(p, { ...vote('player-1', 1), answeredAt: 0, ms: 0 });
    expect(p.slides[0].answerTimes[0].ms).toBe(4_000);
  });

  it('equal speed ties share a rank', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'timer:start' });
    vi.advanceTimersByTime(2_000);
    applyLiveAction(p, vote('a', 1));
    applyLiveAction(p, vote('b', 1));
    applyLiveAction(p, { type: 'voting:set', open: false });
    expect(computeLeaderboard(p).map((e) => e.rank)).toEqual([1, 1]);
  });

  it('the podium with nobody answering has an empty leaderboard and does not throw', () => {
    const p = deck([quiz({ timeLimit: 20 })], { quizScoring: 'speed' });
    applyLiveAction(p, { type: 'finale:set', visible: true });
    const state = publicState(p);
    expect(state.finale).toBe(true);
    expect(state.leaderboard ?? []).toHaveLength(0);
  });
});

describe('winners finale', () => {
  it('showing the podium closes voting, reveals the answers and publishes the leaderboard', () => {
    const p = deck([quiz()]);
    applyLiveAction(p, vote('player-1', 1));
    expect(publicState(p).leaderboard).toBeNull();
    applyLiveAction(p, { type: 'finale:set', visible: true });
    const state = publicState(p);
    expect(state.finale).toBe(true);
    expect(state.votingOpen).toBe(false);
    expect(state.leaderboard).toHaveLength(1);
  });

  it('leaving the slide hides the podium again', () => {
    const p = deck([quiz(), quiz({ id: 's2' })]);
    applyLiveAction(p, { type: 'finale:set', visible: true });
    applyLiveAction(p, { type: 'slide:change', slideIndex: 1 });
    expect(publicState(p).finale).toBe(false);
  });
});
