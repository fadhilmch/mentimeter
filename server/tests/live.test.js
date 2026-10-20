import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';

let app;

beforeAll(async () => {
  app = await setupTestApp();
});
afterAll(teardownTestApp);
beforeEach(clearCollections);

async function seedPresentation() {
  const owner = await User.create({ name: 'P', username: 'presenter', passwordHash: 'x' });
  return Presentation.create({
    owner: owner._id,
    title: 'Live test',
    accessCode: '654321',
    slides: [
      {
        questionType: 'multiple-choice',
        question: 'Pick one',
        options: [{ text: 'A', votes: [] }, { text: 'B', votes: [] }],
        responses: [],
      },
      { questionType: 'open-ended', question: 'Why?', options: [], responses: [] },
    ],
  });
}

describe('live HTTP endpoints (Ably transport path)', () => {
  it('serves public state without vote identities', async () => {
    await seedPresentation();
    const res = await request(app).get('/api/live/654321/state');
    expect(res.status).toBe(200);
    expect(res.body.data.slides[0].options).toEqual(['A', 'B']);
    expect(res.body.data.slides[0].tally).toEqual({ total: 0, counts: [0, 0], percentages: [0, 0] });
    expect(JSON.stringify(res.body)).not.toContain('votes');
  });

  it('returns 404 for unknown codes on state, action and token', async () => {
    expect((await request(app).get('/api/live/000000/state')).status).toBe(404);
    expect((await request(app).post('/api/live/000000/action').send({ type: 'slide:change', slideIndex: 0 })).status).toBe(404);
    expect((await request(app).get('/api/live/000000/token')).status).toBe(501); // transport unconfigured is reported before code lookup
  });

  it('applies actions over HTTP and rejects invalid ones', async () => {
    await seedPresentation();
    const ok = await request(app)
      .post('/api/live/654321/action')
      .send({ type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'participant-1' });
    expect(ok.status).toBe(200);
    expect(ok.body.state.slides[0].tally).toEqual({ total: 1, counts: [0, 1], percentages: [0, 100] });

    const bad = await request(app).post('/api/live/654321/action').send({ type: 'vote:cast', slideIndex: 0, optionIndex: 9, participantId: 'participant-1' });
    expect(bad.status).toBe(400);
    const malformed = await request(app).post('/api/live/654321/action').send({ type: 'nonsense' });
    expect(malformed.status).toBe(400);
  });

  it('token endpoint reports 501 while ABLY_API_KEY is unset', async () => {
    await seedPresentation();
    const res = await request(app).get('/api/live/654321/token');
    expect(res.status).toBe(501);
  });

  it('handles concurrent votes from different participants without losing any', async () => {
    await seedPresentation();
    const voters = Array.from({ length: 10 }, (_, i) => `voter-${i}`);
    const results = await Promise.all(
      voters.map((participantId, i) =>
        request(app).post('/api/live/654321/action').send({ type: 'vote:cast', slideIndex: 0, optionIndex: i % 2, participantId }),
      ),
    );
    const failed = results.filter((r) => r.status !== 200);
    expect(failed.map((r) => `${r.status}: ${JSON.stringify(r.body)}`)).toEqual([]);
    const state = await request(app).get('/api/live/654321/state');
    expect(state.body.data.slides[0].tally.total).toBe(10);
  });

  it('keeps one vote when the same participant votes concurrently', async () => {
    await seedPresentation();
    const results = await Promise.all(
      [0, 1].map((optionIndex) =>
        request(app).post('/api/live/654321/action').send({ type: 'vote:cast', slideIndex: 0, optionIndex, participantId: 'same-voter' }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const state = await request(app).get('/api/live/654321/state');
    expect(state.body.data.slides[0].tally.total).toBe(1);
  });
});
