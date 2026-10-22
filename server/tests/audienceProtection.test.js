import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';
import { registerPresentationSockets } from '../src/sockets/presentation.js';
import { resetAudienceLimiters } from '../src/lib/audience.js';

let app, httpServer, ioServer, port;

beforeAll(async () => {
  app = await setupTestApp();
  httpServer = createServer(app);
  ioServer = new Server(httpServer);
  registerPresentationSockets(ioServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});
afterAll(async () => {
  ioServer.close();
  httpServer.close();
  await teardownTestApp();
});
beforeEach(async () => {
  await clearCollections();
  resetAudienceLimiters();
});
afterEach(() => {
  delete process.env.REQUIRE_PARTICIPANT_TOKEN;
  delete process.env.LIVE_ANSWERS_PER_10S;
  resetAudienceLimiters();
});

async function seed(code = '654321') {
  const owner = await User.create({ name: 'P', username: `p${code}`, passwordHash: 'x' });
  return Presentation.create({
    owner: owner._id, title: 'T', accessCode: code,
    slides: [
      { questionType: 'multiple-choice', question: 'Q1', options: [{ text: 'A', votes: [] }, { text: 'B', votes: [] }], responses: [] },
      { questionType: 'multiple-choice', question: 'Q2', options: [{ text: 'A', votes: [] }, { text: 'B', votes: [] }], responses: [] },
    ],
  });
}
const credential = (code, body = {}) => request(app).post(`/api/live/${code}/credential`).send(body);
const vote = (code, participantId, token, extra = {}) =>
  request(app).post(`/api/live/${code}/action`).set(token ? { 'x-participant-token': token } : {})
    .send({ type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId, ...extra });

describe('participant credentials', () => {
  it('issues a credential for a presentation and refreshes the same id', async () => {
    await seed();
    const first = await credential('654321');
    expect(first.status).toBe(200);
    expect(first.body.participantId).toMatch(/^p-/);
    const again = await credential('654321', { token: first.body.token });
    expect(again.body.participantId).toBe(first.body.participantId);
    expect(first.headers['cache-control']).toContain('no-store');
  });

  it('keeps a pre-existing participant id for migration', async () => {
    await seed();
    const res = await credential('654321', { participantId: 'p-legacy-id' });
    expect(res.body.participantId).toBe('p-legacy-id');
  });

  it('404s for an unknown code', async () => {
    expect((await credential('000000')).status).toBe(404);
  });

  it('a valid credential lets the participant vote', async () => {
    await seed();
    const { body } = await credential('654321');
    expect((await vote('654321', body.participantId, body.token)).status).toBe(200);
  });

  it('refuses a payload participantId that is not the credential owner', async () => {
    await seed();
    const { body } = await credential('654321');
    const res = await vote('654321', 'p-someone-else', body.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('participant_mismatch');
    const doc = await Presentation.findOne({ accessCode: '654321' });
    expect(doc.slides[0].options[0].votes).toHaveLength(0);
  });

  it('refuses a credential from another presentation', async () => {
    await seed('654321');
    await seed('111111');
    const other = (await credential('111111')).body;
    const res = await vote('654321', other.participantId, other.token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_credential');
  });

  it('refuses a forged token', async () => {
    await seed();
    const res = await vote('654321', 'p-forged-id', 'not.a.token');
    expect(res.status).toBe(401);
  });

  it('/me answers for the credential owner, and a token overrides a spoofed header', async () => {
    await seed();
    const a = (await credential('654321')).body;
    const b = (await credential('654321')).body;
    await vote('654321', a.participantId, a.token);
    const mine = await request(app).get('/api/live/654321/me').set({ 'x-participant-token': a.token, 'x-participant-id': b.participantId });
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body.data)).toContain('0');
    const theirs = await request(app).get('/api/live/654321/me').set({ 'x-participant-token': b.token });
    expect(JSON.stringify(theirs.body)).not.toEqual(JSON.stringify(mine.body));
  });

  it('accepts legacy no-token actions by default but not when tokens are required', async () => {
    await seed();
    expect((await vote('654321', 'p-legacy-id')).status).toBe(200);
    process.env.REQUIRE_PARTICIPANT_TOKEN = 'true';
    const res = await vote('654321', 'p-legacy-id');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('credential_required');
  });
});

describe('rate limits', () => {
  it('429s a participant who floods answers, with Retry-After, and leaves others alone', async () => {
    process.env.LIVE_ANSWERS_PER_10S = '3';
    resetAudienceLimiters();
    await seed();
    for (let i = 0; i < 3; i += 1) expect((await vote('654321', 'p-flooder')).status).toBe(200);
    const blocked = await vote('654321', 'p-flooder');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('rate_limited');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await vote('654321', 'p-other-person')).status).toBe(200);
  });

  it('throttles nickname changes separately from answers', async () => {
    await seed();
    let last;
    for (let i = 0; i < 8; i += 1) {
      last = await request(app).post('/api/live/654321/action').send({ type: 'participant:identify', participantId: 'p-nick-user', nickname: `N${i}` });
    }
    expect(last.status).toBe(429);
  });

  it('a whole classroom on one IP is not blocked', async () => {
    await seed();
    for (let i = 0; i < 60; i += 1) expect((await vote('654321', `p-student-${i}`)).status).toBe(200);
  });

  it('applies on the socket transport too', async () => {
    process.env.LIVE_ANSWERS_PER_10S = '2';
    resetAudienceLimiters();
    await seed();
    const s = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    const emit = (e, p) => new Promise((r) => s.emit(e, p, r));
    await emit('presentation:join', { accessCode: '654321' });
    const act = () => emit('live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-sock-user' });
    expect((await act()).ok).toBe(true);
    expect((await act()).ok).toBe(true);
    const blocked = await act();
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe('rate_limited');
    s.disconnect();
  });

  it('socket refuses a credential that does not match the participant', async () => {
    await seed();
    const cred = (await credential('654321')).body;
    const s = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    const emit = (e, p) => new Promise((r) => s.emit(e, p, r));
    await emit('presentation:join', { accessCode: '654321' });
    const bad = await emit('live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-impostor', token: cred.token });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('participant_mismatch');
    const good = await emit('live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: cred.participantId, token: cred.token });
    expect(good.ok).toBe(true);
    s.disconnect();
  });
});

describe('stale slide', () => {
  it('returns a code and fresh state so the client can recover', async () => {
    await seed();
    const res = await vote('654321', 'p-late-one', undefined, { slideIndex: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('slide_not_active');
    expect(res.body.state.currentSlide).toBe(0);
  });
});
