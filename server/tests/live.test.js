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
    expect((await request(app).post('/api/live/000000/action').send({ type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-abcdef' })).status).toBe(404);
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

describe('presenter live controls', () => {
  async function signup(username = 'owner1') {
    const res = await request(app).post('/api/users/signup').send({ username, password: 'super-secret-1' });
    return res.body.token;
  }

  it('slide control is presenter-only: public channels cannot change slides or reopen voting', async () => {
    const token = await signup();
    const mine = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Mine', slides: [
        { questionType: 'multiple-choice', question: 'One', options: ['A', 'B'] },
        { questionType: 'multiple-choice', question: 'Two', options: ['A', 'B'] },
      ] });
    const id = mine.body.data._id;
    const code = mine.body.data.accessCode;
    const live = (b) => request(app).post(`/api/live/${code}/action`).send(b);
    const owner = (b, t = token) => request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${t}`).send(b);

    expect((await live({ type: 'slide:change', slideIndex: 1 })).status).toBe(400);
    expect((await request(app).post(`/api/presentations/${id}/live-actions`).send({ type: 'slide:change', slideIndex: 1 })).status).toBe(401);
    const other = await signup('someone-else');
    expect((await owner({ type: 'slide:change', slideIndex: 1 }, other)).status).toBe(404);
    expect((await request(app).get(`/api/live/${code}/state`)).body.data.currentSlide).toBe(0);

    await owner({ type: 'voting:set', open: false });
    // A participant cannot reopen voting by changing slides.
    await live({ type: 'slide:change', slideIndex: 1 });
    expect((await request(app).get(`/api/live/${code}/state`)).body.data.votingOpen).toBe(false);

    // The presenter moving on does reopen voting for the new slide.
    const moved = await owner({ type: 'slide:change', slideIndex: 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.state.currentSlide).toBe(1);
    expect(moved.body.state.votingOpen).toBe(true);
    expect((await owner({ type: 'slide:change', slideIndex: 9 })).status).toBe(400);
  });

  it('resets votes, toggles voting and results, owner only', async () => {
    const token = await signup();
    const seeded = await seedPresentation();
    // seedPresentation creates its own owner; make one owned by the signed-up user instead
    const mine = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Mine', slides: [{ questionType: 'multiple-choice', question: 'Pick', options: ['A', 'B'] }] });
    const id = mine.body.data._id;
    const code = mine.body.data.accessCode;

    await request(app).post(`/api/live/${code}/action`).send({ type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'participant-1' });

    const unauth = await request(app).post(`/api/presentations/${id}/live-actions`).send({ type: 'vote:reset', slideIndex: 0 });
    expect(unauth.status).toBe(401);

    const reset = await request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${token}`).send({ type: 'vote:reset', slideIndex: 0 });
    expect(reset.status).toBe(200);
    expect(reset.body.state.slides[0].tally.total).toBe(0);

    const close = await request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${token}`).send({ type: 'voting:set', open: false });
    expect(close.status).toBe(200);
    expect(close.body.state.votingOpen).toBe(false);

    const blocked = await request(app).post(`/api/live/${code}/action`).send({ type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'participant-2' });
    expect(blocked.status).toBe(400);

    const hide = await request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${token}`).send({ type: 'results:set', visible: false });
    expect(hide.status).toBe(200);
    expect(hide.body.state.resultsVisible).toBe(false);
    // hidden: projection strips tallies from every audience channel
    expect(hide.body.state.slides[0].tally).toBeNull();
    const codeJoin = await request(app).get(`/api/presentations/code/${code}`);
    expect(codeJoin.status).toBe(200);
    expect(codeJoin.body.data.slides[0].tally).toBeNull();
    expect(codeJoin.body.data.slides[0].options[0].votes).toBeUndefined();
    const liveJoin = await request(app).get(`/api/live/${code}/state`);
    if (liveJoin.status === 200) expect(liveJoin.body.data.slides[0].tally).toBeNull();
    // reveal restores the projection
    const reveal = await request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${token}`).send({ type: 'results:set', visible: true });
    expect(reveal.body.state.slides[0].tally).not.toBeNull();
    const rejoined = await request(app).get(`/api/presentations/code/${code}`);
    expect(rejoined.body.data.slides[0].tally).not.toBeNull();
    expect(rejoined.body.data.slides[0].options[0].votes).toBeUndefined();

    const other = await request(app).post(`/api/presentations/${seeded._id}/live-actions`).set('authorization', `Bearer ${token}`).send({ type: 'voting:set', open: false });
    expect(other.status).toBe(404);
  });
});
