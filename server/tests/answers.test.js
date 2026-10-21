import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';
import { answersFor } from '../src/lib/answers.js';

let app;
beforeAll(async () => {
  app = await setupTestApp();
});
afterAll(teardownTestApp);
beforeEach(clearCollections);

const ME = 'p-me-123456';
const OTHER = 'p-other-654321';

const slides = () => [
  { questionType: 'multiple-choice', question: 'Pick', options: [{ text: 'A', votes: [OTHER] }, { text: 'B', votes: [ME] }] },
  { questionType: 'rating', question: 'Rate', ratings: [{ authorId: ME, value: 7 }, { authorId: OTHER, value: 2 }] },
  { questionType: 'word-cloud', question: 'Word', responses: [{ text: 'momentum', authorId: ME, upvotes: [] }] },
  { questionType: 'ranking', question: 'Rank', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], rankings: [{ authorId: ME, order: ['b', 'a'] }] },
  { questionType: 'open-ended', question: 'Idea', responses: [{ text: 'x', authorId: OTHER, upvotes: [ME] }, { text: 'y', authorId: OTHER, upvotes: [] }] },
  { questionType: 'multiple-choice', question: 'Unanswered', options: [{ text: 'A', votes: [] }, { text: 'B', votes: [] }] },
];

describe('answersFor', () => {
  it("returns only the caller's own answer per slide and omits unanswered slides", () => {
    expect(answersFor({ slides: slides() }, ME)).toEqual({
      0: { vote: 1 },
      1: { rating: 7 },
      2: { word: 'momentum' },
      3: { ranking: ['b', 'a'] },
      4: { upvotes: [0] },
    });
  });

  it('returns nothing for an unknown participant', () => {
    expect(answersFor({ slides: slides() }, 'p-nobody-0000')).toEqual({});
  });
});

describe('GET /api/live/:code/me', () => {
  async function seed() {
    const owner = await User.create({ name: 'P', username: 'presenter', passwordHash: 'x' });
    return Presentation.create({ owner: owner._id, title: 'T', accessCode: '111222', slides: slides() });
  }

  it('returns the callers answers from the header id', async () => {
    await seed();
    const res = await request(app).get('/api/live/111222/me').set('x-participant-id', ME);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ vote: 1 });
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers.vary).toContain("x-participant-id");
    const other = await request(app).get("/api/live/111222/me").set("x-participant-id", OTHER);
    expect(other.body.data[0]).toEqual({ vote: 0 });
    expect(other.body.data[1]).toEqual({ rating: 2 });
  });

  it('requires the participant header and a known code', async () => {
    await seed();
    expect((await request(app).get('/api/live/111222/me')).status).toBe(400);
    expect((await request(app).get('/api/live/999999/me').set('x-participant-id', ME)).status).toBe(404);
  });
});
