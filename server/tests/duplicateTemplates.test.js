import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { Presentation } from '../src/models/presentation.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

const signup = async (u) => (await request(app).post('/api/users/signup').send({ username: u, password: 'super-secret-1' })).body.token;
const auth = (t) => ({ authorization: `Bearer ${t}` });

describe('templates', () => {
  it('lists three starters and creates a valid deck from each', async () => {
    const t = await signup('tmpl');
    const list = await request(app).get('/api/presentations/templates').set(auth(t));
    expect(list.body.data.map((x) => x.key)).toEqual(['retrospective', 'workshop-feedback', 'training-quiz']);
    for (const { key } of list.body.data) {
      const res = await request(app).post(`/api/presentations/from-template/${key}`).set(auth(t));
      expect(res.status).toBe(201);
      expect(res.body.data.accessCode).toMatch(/^\d{6}$/);
      for (const slide of res.body.data.slides) {
        expect(slide.id).toBeTruthy();
        for (const o of slide.options) expect(o.id).toBeTruthy();
      }
    }
  });

  it('the quiz template marks a real correct option on every slide', async () => {
    const t = await signup('quizt');
    const res = await request(app).post('/api/presentations/from-template/training-quiz').set(auth(t));
    for (const slide of res.body.data.slides) {
      expect(slide.options.some((o) => o.id === slide.correctOptionId)).toBe(true);
      expect(slide.revealed).toBe(false);
    }
  });

  it('404s for an unknown template and needs sign-in', async () => {
    const t = await signup('nope');
    expect((await request(app).post('/api/presentations/from-template/missing').set(auth(t))).status).toBe(404);
    expect((await request(app).get('/api/presentations/templates')).status).toBe(401);
  });
});

describe('duplicate deck', () => {
  async function seededQuiz() {
    const t = await signup('dup');
    const created = await request(app).post('/api/presentations/from-template/training-quiz').set(auth(t));
    const doc = await Presentation.findById(created.body.data._id);
    doc.slides[0].options[1].votes.push('p-voter-aaaa');
    doc.slides[0].revealed = true;
    doc.participants.push({ participantId: 'p-voter-aaaa', nickname: 'Nick' });
    doc.theme = 'plum';
    doc.slides[1].design = { accent: '#112233' };
    await doc.save();
    return { t, id: String(doc._id), doc };
  }

  it('copies structure with fresh ids and remaps the correct answer, copying no audience data', async () => {
    const { t, id, doc } = await seededQuiz();
    const res = await request(app).post(`/api/presentations/${id}/duplicate`).set(auth(t));
    expect(res.status).toBe(201);
    const copy = res.body.data;
    expect(copy.title).toMatch(/^Copy of /);
    expect(copy._id).not.toBe(id);
    expect(copy.accessCode).not.toBe(doc.accessCode);
    expect(copy.theme).toBe('plum');
    expect(copy.participants).toEqual([]);
    copy.slides.forEach((slide, i) => {
      const orig = doc.slides[i];
      expect(slide.id).not.toBe(orig.id);
      expect(slide.question).toBe(orig.question);
      expect(slide.revealed).toBe(false);
      expect(slide.options.map((o) => o.text)).toEqual(orig.options.map((o) => o.text));
      slide.options.forEach((o, k) => { expect(o.id).not.toBe(orig.options[k].id); expect(o.votes).toEqual([]); });
      const origCorrect = orig.options.findIndex((o) => o.id === orig.correctOptionId);
      expect(slide.options[origCorrect].id).toBe(slide.correctOptionId);
    });
    expect(copy.slides[1].design.accent).toBe('#112233');
    const original = await Presentation.findById(id);
    expect(original.slides[0].options[1].votes).toEqual(['p-voter-aaaa']);
  });

  it("is owner-only: someone else's deck is a 404", async () => {
    const { id } = await seededQuiz();
    const other = await signup('other-dup');
    expect((await request(app).post(`/api/presentations/${id}/duplicate`).set(auth(other))).status).toBe(404);
    expect((await request(app).post('/api/presentations/bad-id/duplicate').set(auth(other))).status).toBe(404);
  });
});
