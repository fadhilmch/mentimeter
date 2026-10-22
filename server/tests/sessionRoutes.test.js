import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memory, app, owner, other, deck;
beforeAll(async () => {
  process.env.SESSIONS_ENABLED = 'true';
  const { createApp } = await import('../src/app.js');
  const { connectDatabase } = await import('../src/db.js');
  memory = await MongoMemoryServer.create();
  await connectDatabase(memory.getUri());
  app = createApp();
  owner = (await request(app).post('/api/users/signup').send({ username: `o${Date.now()}`, password: 'super-secret-1' })).body.token;
  other = (await request(app).post('/api/users/signup').send({ username: `x${Date.now()}`, password: 'super-secret-1' })).body.token;
  deck = (await request(app).post('/api/presentations').set('authorization', `Bearer ${owner}`)
    .send({ title: 'D', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] })).body.data;
});
afterAll(async () => { const { disconnectDatabase } = await import('../src/db.js'); await disconnectDatabase(); await memory.stop(); });

const as = (t, r) => r.set('authorization', `Bearer ${t}`);

describe('session lifecycle (flag on)', () => {
  it('starts distinct sessions with their own codes, ends, archives and deletes', async () => {
    const a = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    const b = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    expect(a.code).not.toBe(b.code);
    expect(a.code).not.toBe(deck.accessCode);
    expect((await as(owner, request(app).post(`/api/sessions/${a.id}/archive`))).status).toBe(409);
    expect((await as(owner, request(app).delete(`/api/sessions/${a.id}`))).status).toBe(409);
    expect((await as(owner, request(app).post(`/api/sessions/${a.id}/end`))).body.data.status).toBe('ended');
    expect((await as(owner, request(app).post(`/api/sessions/${a.id}/archive`))).body.data.status).toBe('archived');
    expect((await as(owner, request(app).delete(`/api/sessions/${a.id}`))).status).toBe(204);
    const list = (await as(owner, request(app).get(`/api/presentations/${deck._id}/sessions`))).body.data;
    expect(list.map((s) => s.id)).toEqual([b.id]);
  });
  it('hides sessions from other owners and anonymous callers', async () => {
    const s = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    expect((await as(other, request(app).post(`/api/sessions/${s.id}/end`))).status).toBe(404);
    expect((await as(other, request(app).post(`/api/presentations/${deck._id}/sessions`))).status).toBe(404);
    expect((await request(app).post(`/api/sessions/${s.id}/end`)).status).toBe(401);
  });
});

describe('audience answers go to the session, not the deck', () => {
  it('keeps each run separate and freezes an ended run', async () => {
    const { applyLiveActionByCode } = await import('../src/lib/live.js');
    const run1 = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    const run2 = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    await applyLiveActionByCode(run1.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-aaaaaa' });
    await applyLiveActionByCode(run1.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-bbbbbb' });
    await applyLiveActionByCode(run2.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-cccccc' });
    const s1 = (await as(owner, request(app).get(`/api/sessions/${run1.id}/state`))).body.data;
    const s2 = (await as(owner, request(app).get(`/api/sessions/${run2.id}/state`))).body.data;
    expect(s1.slides[0].tally.total).toBe(2);
    expect(s2.slides[0].tally.total).toBe(1);
    const deckNow = (await request(app).get(`/api/live/${deck.accessCode}/state`)).body.data;
    expect(deckNow.slides[0].tally.total).toBe(0); // the deck itself is untouched

    // Presenter control is per session; ending releases the code and rejects further control.
    const toggled = await as(owner, request(app).post(`/api/sessions/${run1.id}/live-actions`)).send({ type: 'results:set', visible: true });
    expect(toggled.status).toBe(200);
    await as(owner, request(app).post(`/api/sessions/${run1.id}/end`));
    expect((await as(owner, request(app).post(`/api/sessions/${run1.id}/live-actions`)).send({ type: 'voting:set', open: true })).status).toBe(409);
    const afterEnd = (await as(owner, request(app).get(`/api/sessions/${run1.id}/state`))).body.data;
    expect(afterEnd.slides[0].tally.total).toBe(2); // answers are kept
  });
});

describe('session report', () => {
  it('is per run, and final once the run has ended', async () => {
    const { applyLiveActionByCode } = await import('../src/lib/live.js');
    const run = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    await applyLiveActionByCode(run.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-report1' });
    const live = (await as(owner, request(app).get(`/api/sessions/${run.id}/report`))).body.data;
    expect(live.scope).toMatch(/still running/);
    expect(live.slides[0].options[0].count).toBe(1);
    await as(owner, request(app).post(`/api/sessions/${run.id}/end`));
    await expect(applyLiveActionByCode(run.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-report2' })).resolves.not.toThrow();
    const done = (await as(owner, request(app).get(`/api/sessions/${run.id}/report`))).body.data;
    expect(done.scope).toMatch(/final/);
    expect(done.slides[0].options.map((o) => o.count)).toEqual([1, 0]); // a late vote did not change the ended run
    expect((await as(other, request(app).get(`/api/sessions/${run.id}/report`))).status).toBe(404);
  });
});

describe('session csv export', () => {
  it('exports a run by its session id, owner only', async () => {
    const { applyLiveActionByCode } = await import('../src/lib/live.js');
    const run = (await as(owner, request(app).post(`/api/presentations/${deck._id}/sessions`))).body.data;
    await applyLiveActionByCode(run.code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-csv001' });
    const res = await as(owner, request(app).get(`/api/presentations/${run.id}/export.csv?kind=summary`));
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/votes,1/);
    expect((await as(other, request(app).get(`/api/presentations/${run.id}/export.csv?kind=summary`))).status).toBe(404);
  });
});
