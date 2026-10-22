import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { Presentation } from '../src/models/presentation.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

async function signup(name) {
  const r = await request(app).post('/api/users/signup').send({ username: name, password: 'super-secret-1' });
  return r.body.token;
}
const make = (token, i, extra = {}) =>
  request(app).post('/api/presentations').set('authorization', `Bearer ${token}`)
    .send({ title: `Deck ${i}`, slides: [{ questionType: 'multiple-choice', question: 'Q', options: ['a', 'b'] }, { questionType: 'open-ended', question: 'Why' }], ...extra });

describe('dashboard listing', () => {
  it('returns metadata only: no slides, answers or voter ids', async () => {
    const token = await signup('lister');
    await make(token, 1);
    const doc = await Presentation.findOne({});
    doc.slides[0].options[0].votes.push('p-secret-voter');
    await doc.save();
    const res = await request(app).get('/api/presentations').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ title: 'Deck 1', slideCount: 2 });
    expect(res.body.data[0].slides).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('p-secret-voter');
    expect(res.body.total).toBe(1);
    expect(res.body.nextCursor).toBeNull();
  });

  it('pages newest first with a cursor, without gaps or repeats', async () => {
    const token = await signup('pager');
    for (let i = 1; i <= 5; i += 1) await make(token, i);
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const res = await request(app).get('/api/presentations').query({ limit: 2, ...(cursor ? { cursor } : {}) }).set('authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
      seen.push(...res.body.data.map((d) => d.title));
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual(['Deck 5', 'Deck 4', 'Deck 3', 'Deck 2', 'Deck 1']);
  });

  it("never lists another user's presentations", async () => {
    const a = await signup('owner-a');
    const b = await signup('owner-b');
    await make(a, 1);
    const res = await request(app).get('/api/presentations').set('authorization', `Bearer ${b}`);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('rejects bad paging parameters', async () => {
    const token = await signup('badpage');
    expect((await request(app).get('/api/presentations?limit=0').set('authorization', `Bearer ${token}`)).status).toBe(400);
    expect((await request(app).get('/api/presentations?cursor=nope').set('authorization', `Bearer ${token}`)).status).toBe(400);
  });

  it('response size does not grow with collected answers', async () => {
    const token = await signup('sizer');
    await make(token, 1);
    const size = async () => (await request(app).get('/api/presentations').set('authorization', `Bearer ${token}`)).text.length;
    const before = await size();
    const doc = await Presentation.findOne({});
    for (let i = 0; i < 300; i += 1) doc.slides[0].options[0].votes.push(`p-voter-${i}-xxxx`);
    await doc.save();
    expect(await size()).toBe(before);
  });
});

describe('readiness', () => {
  it('liveness and readiness are separate endpoints', async () => {
    expect((await request(app).get('/api/health')).body.status).toBe('ok');
    const ready = await request(app).get('/api/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');
  });
});
