import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';
import { Presentation } from '../src/models/presentation.js';
import { applyLiveActionByCode } from '../src/lib/live.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

describe('saving slides while the audience votes', () => {
  it('applies the edit on top of the newest votes: edit saved, no vote lost, no failed save', async () => {
    const signup = await request(app).post('/api/users/signup').send({ username: 'racer', password: 'super-secret-1' }).expect(201);
    const auth = { authorization: `Bearer ${signup.body.token}` };
    const created = await request(app).post('/api/presentations').set(auth)
      .send({ title: 'Demo', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] }).expect(201);
    const id = created.body.data._id;
    const code = created.body.data.accessCode;
    const loaded = await request(app).get(`/api/presentations/${id}`).set(auth).expect(200);
    const slide = loaded.body.data.slides[0];
    const edit = () => request(app).put(`/api/presentations/${id}`).set(auth).send({
      baseStructureRevision: loaded.body.data.structureRevision,
      slides: [{ id: slide.id, questionType: 'multiple-choice', question: 'Q edited?', options: slide.options.map((o) => ({ id: o.id, text: o.text })) }],
    });
    const votes = Array.from({ length: 60 }, (_, i) =>
      applyLiveActionByCode(code, { type: 'vote:cast', slideIndex: 0, optionIndex: i % 2, participantId: `p-edit-${i}` }));
    const [saved, ...voteResults] = await Promise.allSettled([edit().then((r) => r), ...votes]);
    expect(saved.value.status).toBe(200);
    expect(voteResults.filter((r) => r.status === 'rejected')).toHaveLength(0);
    const doc = await Presentation.findById(id);
    expect(doc.slides[0].question).toBe('Q edited?');
    expect(doc.slides[0].options[0].votes.length + doc.slides[0].options[1].votes.length).toBe(60);
  });
});
