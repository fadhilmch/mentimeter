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
