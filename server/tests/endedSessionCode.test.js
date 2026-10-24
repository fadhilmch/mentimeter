import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memory, app, owner, deck;
beforeAll(async () => {
  process.env.SESSIONS_ENABLED = 'true';
  const { createApp } = await import('../src/app.js');
  const { connectDatabase } = await import('../src/db.js');
  memory = await MongoMemoryServer.create();
  await connectDatabase(memory.getUri());
  app = createApp();
  owner = (await request(app).post('/api/users/signup').send({ username: `e${Date.now()}`, password: 'super-secret-1' })).body.token;
  deck = (await request(app).post('/api/presentations').set('authorization', `Bearer ${owner}`)
    .send({ title: 'D', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] })).body.data;
});
afterAll(async () => { const { disconnectDatabase } = await import('../src/db.js'); await disconnectDatabase(); await memory.stop(); });

const as = (r) => r.set('authorization', `Bearer ${owner}`);
const start = async () => (await as(request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;

describe('a code whose session has ended', () => {
  it('answers 410 session_ended on every audience endpoint and reveals no session data', async () => {
    const run = await start();
    await as(request(app).post(`/api/sessions/${run.id}/end`));
    const pid = 'participant-123';
    const replies = [
      await request(app).get(`/api/live/${run.code}/state`),
      await request(app).get(`/api/live/${run.code}/me`).set('x-participant-id', pid),
      await request(app).post(`/api/live/${run.code}/credential`).send({}),
      await request(app).post(`/api/live/${run.code}/action`).set('x-participant-token', 'x').send({ type: 'vote', slideIndex: 0, optionIndex: 0 }),
    ];
    for (const r of replies) {
      if (r.status === 429 || r.status === 400 || r.status === 401 || r.status === 403) continue; // guards may answer first
      expect(r.status).toBe(410);
      expect(r.body.code).toBe('session_ended');
      expect(JSON.stringify(r.body)).not.toMatch(/Q\?|title|slides/);
    }
    expect(replies[0].status).toBe(410);
    expect(replies[2].status).toBe(410);
  });

  it('still answers 404 for a code that never existed or whose session was deleted', async () => {
    expect((await request(app).get('/api/live/000000/state')).status).toBe(404);
    const run = await start();
    await as(request(app).post(`/api/sessions/${run.id}/end`));
    await as(request(app).delete(`/api/sessions/${run.id}`));
    expect((await request(app).get(`/api/live/${run.code}/state`)).status).toBe(404);
  });

  it('does not say "ended" while the deck code itself is live', async () => {
    const run = await start();
    await as(request(app).post(`/api/sessions/${run.id}/end`));
    expect((await request(app).get(`/api/live/${deck.accessCode}/state`)).status).toBe(200);
  });
});
