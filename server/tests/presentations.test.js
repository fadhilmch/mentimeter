import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

async function signup(username = 'fadhil') {
  const res = await request(app).post('/api/users/signup').send({ username, password: 'super-secret-1' });
  return res.body.token;
}

describe('presentation routes', () => {
  it('creates with a 6-digit access code and joins publicly by code', async () => {
    const token = await signup();
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Demo', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] })
      .expect(201);
    expect(created.body.data.accessCode).toMatch(/^\d{6}$/);
    expect(created.body.data.slides[0].options).toEqual([
      { text: 'a', votes: [] },
      { text: 'b', votes: [] },
    ]);

    const joined = await request(app).get(`/api/presentations/code/${created.body.data.accessCode}`).expect(200);
    expect(joined.body.data.title).toBe('Demo');
    await request(app).get('/api/presentations/code/000000').expect(404);
  });

  it('requires auth and ownership', async () => {
    await request(app).get('/api/presentations').expect(401);
    await request(app).get('/api/presentations').set('authorization', 'Bearer nope').expect(401);

    const mine = await signup('mine');
    const other = await signup('other');
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${mine}`)
      .send({ title: 'Mine', slides: [] })
      .expect(201);
    await request(app).get(`/api/presentations/${created.body.data._id}`).set('authorization', `Bearer ${other}`).expect(404);
    await request(app).delete(`/api/presentations/${created.body.data._id}`).set('authorization', `Bearer ${other}`).expect(404);
    await request(app).delete(`/api/presentations/${created.body.data._id}`).set('authorization', `Bearer ${mine}`).expect(200);
  });

  it('edits slides without losing cast votes', async () => {
    const token = await signup();
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Demo', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] })
      .expect(201);
    const id = created.body.data._id;

    const { Presentation } = await import('../src/models/presentation.js');
    const doc = await Presentation.findById(id);
    doc.slides[0].options[0].votes.push('p1');
    await doc.save();

    const updated = await request(app)
      .put(`/api/presentations/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ slides: [{ questionType: 'multiple-choice', question: 'Q edited?', options: ['a', 'b', 'c'] }] })
      .expect(200);
    expect(updated.body.data.slides[0].question).toBe('Q edited?');
    expect(updated.body.data.slides[0].options[0].votes).toEqual(['p1']);
    expect(updated.body.data.slides[0].options[2].votes).toEqual([]);
  });
});
