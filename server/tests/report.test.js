import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { applyLiveActionByCode } from '../src/lib/live.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';

let memory, app;
beforeAll(async () => { memory = await MongoMemoryServer.create(); await connectDatabase(memory.getUri()); app = createApp(); });
afterAll(async () => { await disconnectDatabase(); await memory.stop(); });

describe('owner report', () => {
  it('returns tallies to the owner only', async () => {
    const owner = await request(app).post('/api/users/signup').send({ username: `r${Date.now()}`, password: 'super-secret-1' });
    const other = await request(app).post('/api/users/signup').send({ username: `s${Date.now()}`, password: 'super-secret-1' });
    const created = await request(app).post('/api/presentations').set('authorization', `Bearer ${owner.body.token}`)
      .send({ title: 'R', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] });
    const id = created.body.data._id;
    const code = created.body.data.accessCode;
    await applyLiveActionByCode(code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p1' });
    const res = await request(app).get(`/api/presentations/${id}/report`).set('authorization', `Bearer ${owner.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slides[0].options.map((o) => o.text)).toEqual(['a', 'b']);
    expect(res.body.data.slides[0].options[1].count).toBe(1);
    expect(res.body.data.scope).toMatch(/not separated by session/);
    const denied = await request(app).get(`/api/presentations/${id}/report`).set('authorization', `Bearer ${other.body.token}`);
    expect(denied.status).toBe(404);
    expect((await request(app).get(`/api/presentations/${id}/report`)).status).toBe(401);
  });
});
