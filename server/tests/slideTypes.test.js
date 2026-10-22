import { describe, it, expect } from 'vitest';
import { castVote, tallySlide, submitWord, castRating, submitRanking, resetSlide } from '../src/lib/results.js';

const wordSlide = () => ({ questionType: 'word-cloud', question: 'One word for Mondays?', options: [], responses: [] });
const ratingSlide = () => ({ questionType: 'rating', question: 'Rate the venue', options: [], ratings: [] });
const rankingSlide = () => ({
  questionType: 'ranking',
  question: 'Rank the snacks',
  options: [
    { id: 'opt-a', text: 'Chips', votes: [] },
    { id: 'opt-b', text: 'Fruit', votes: [] },
    { id: 'opt-c', text: 'Candy', votes: [] },
  ],
  rankings: [],
});
const quizSlide = () => ({
  questionType: 'quiz',
  question: 'Capital of Sweden?',
  correctOptionId: 'opt-b',
  options: [
    { id: 'opt-a', text: 'Oslo', votes: [] },
    { id: 'opt-b', text: 'Stockholm', votes: [] },
  ],
  responses: [],
});

describe('word cloud', () => {
  it('keeps one lowercased word per participant, replacing on resubmit', () => {
    const slide = wordSlide();
    submitWord(slide, '  TIRED ', 'p1');
    submitWord(slide, 'tired', 'p2');
    submitWord(slide, 'cozy', 'p1');
    expect(slide.responses.map((r) => r.text)).toEqual(['tired', 'cozy']);
    expect(slide.responses.map((r) => r.authorId)).toEqual(['p2', 'p1']);
  });

  it('rejects empty, multi-word and oversized submissions', () => {
    const slide = wordSlide();
    expect(() => submitWord(slide, '   ', 'p1')).toThrow(TypeError);
    expect(() => submitWord(slide, 'two words', 'p1')).toThrow(TypeError);
    expect(() => submitWord(slide, 'x'.repeat(41), 'p1')).toThrow(RangeError);
    expect(() => submitWord({ questionType: 'open-ended', responses: [] }, 'hey', 'p1')).toThrow(TypeError);
  });

  it('tallies per normalized word, most frequent first', () => {
    const slide = wordSlide();
    submitWord(slide, 'cozy', 'p1');
    submitWord(slide, 'tired', 'p2');
    submitWord(slide, 'cozy', 'p3');
    expect(tallySlide(slide)).toEqual({
      total: 3,
      words: [
        { text: 'cozy', count: 2 },
        { text: 'tired', count: 1 },
      ],
    });
  });
});

describe('rating', () => {
  it('averages one rating per participant: a re-rate replaces, it never adds a second entry', () => {
    const slide = ratingSlide();
    castRating(slide, 6, 'participant-aaa');
    castRating(slide, 2, 'participant-aaa');
    expect(tallySlide(slide)).toMatchObject({ total: 1, average: 2 });
    castRating(slide, 6, 'participant-bbb');
    expect(tallySlide(slide)).toMatchObject({ total: 2, average: 4 });
  });

  it('keeps one 1-10 rating per participant, replacing on re-rate', () => {
    const slide = ratingSlide();
    castRating(slide, 8, 'p1');
    castRating(slide, 10, 'p2');
    castRating(slide, 7, 'p1');
    expect(slide.ratings).toEqual([
      { authorId: 'p2', value: 10 },
      { authorId: 'p1', value: 7 },
    ]);
  });

  it('rejects values outside 1-10 and non-integers', () => {
    const slide = ratingSlide();
    expect(() => castRating(slide, 0, 'p1')).toThrow(RangeError);
    expect(() => castRating(slide, 11, 'p1')).toThrow(RangeError);
    expect(() => castRating(slide, 7.5, 'p1')).toThrow(RangeError);
    expect(() => castRating({ questionType: 'quiz', options: [] }, 5, 'p1')).toThrow(TypeError);
  });

  it('tallies average and a 10-bucket distribution', () => {
    const slide = ratingSlide();
    castRating(slide, 10, 'p1');
    castRating(slide, 8, 'p2');
    castRating(slide, 8, 'p3');
    const tally = tallySlide(slide);
    expect(tally.total).toBe(3);
    expect(tally.average).toBe(8.7);
    expect(tally.buckets).toEqual([0, 0, 0, 0, 0, 0, 0, 2, 0, 1]);
  });
});

describe('ranking', () => {
  it('keeps one full ordering per participant, replacing on resubmit', () => {
    const slide = rankingSlide();
    submitRanking(slide, ['opt-a', 'opt-b', 'opt-c'], 'p1');
    submitRanking(slide, ['opt-c', 'opt-a', 'opt-b'], 'p1');
    expect(slide.rankings).toEqual([{ authorId: 'p1', order: ['opt-c', 'opt-a', 'opt-b'] }]);
  });

  it('rejects partial, duplicated or foreign orderings', () => {
    const slide = rankingSlide();
    expect(() => submitRanking(slide, ['opt-a', 'opt-b'], 'p1')).toThrow(RangeError);
    expect(() => submitRanking(slide, ['opt-a', 'opt-a', 'opt-c'], 'p1')).toThrow(RangeError);
    expect(() => submitRanking(slide, ['opt-a', 'opt-b', 'opt-z'], 'p1')).toThrow(RangeError);
  });

  it('tallies Borda-style points across ballots', () => {
    const slide = rankingSlide();
    submitRanking(slide, ['opt-a', 'opt-b', 'opt-c'], 'p1'); // a=3, b=2, c=1
    submitRanking(slide, ['opt-c', 'opt-a', 'opt-b'], 'p2'); // c=3, a=2, b=1
    expect(tallySlide(slide)).toEqual({ total: 2, points: [5, 3, 4] });
  });
});

describe('quiz', () => {
  it('votes like multiple choice and tallies the correct count by option id', () => {
    const slide = quizSlide();
    castVote(slide, 1, 'p1');
    castVote(slide, 0, 'p2');
    castVote(slide, 1, 'p3');
    expect(tallySlide(slide)).toEqual({
      total: 3,
      counts: [1, 2],
      percentages: [33.3, 66.7],
      correctOptionIndex: 1,
      correctCount: 2,
    });
  });

  it('reports no correct index when correctOptionId matches nothing', () => {
    const slide = { ...quizSlide(), correctOptionId: 'opt-gone' };
    castVote(slide, 0, 'p1');
    const tally = tallySlide(slide);
    expect(tally.correctOptionIndex).toBe(-1);
    expect(tally.correctCount).toBe(0);
  });
});

describe('resetSlide on new types', () => {
  it('clears ratings, rankings, words and quiz votes', () => {
    const rating = ratingSlide();
    castRating(rating, 5, 'p1');
    expect(resetSlide(rating).ratings).toEqual([]);

    const ranking = rankingSlide();
    submitRanking(ranking, ['opt-a', 'opt-b', 'opt-c'], 'p1');
    expect(resetSlide(ranking).rankings).toEqual([]);

    const word = wordSlide();
    submitWord(word, 'cozy', 'p1');
    expect(resetSlide(word).responses).toEqual([]);

    const quiz = quizSlide();
    castVote(quiz, 1, 'p1');
    expect(resetSlide(quiz).options[1].votes).toEqual([]);
  });
});
