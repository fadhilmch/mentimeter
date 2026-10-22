import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { Presentation } from '../src/models/presentation.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

const auth = (t) => ({ authorization: `Bearer ${t}` });
async function setup(username = 'mod-owner') {
  const t = (await request(app).post('/api/users/signup').send({ username, password: 'super-secret-1' })).body.token;
  const created = await request(app).post('/api/presentations').set(auth(t)).send({
    title: 'Mod',
    slides: [
      { questionType: 'open-ended', question: 'Why?' },
      { questionType: 'word-cloud', question: 'One word' },
    ],
  });
  const { _id: id, accessCode: code } = created.body.data;
  return { t, id, code };
}
const act = (code, body) => request(app).post(`/api/live/${code}/action`).send(body);
const say = (code, p, text, clientId) => act(code, { type: 'response:add', slideIndex: 0, text, participantId: p, ...(clientId ? { clientId } : {}) });
const word = (code, p, text) => act(code, { type: 'word:submit', slideIndex: 1, text, participantId: p });
const pub = async (code) => (await request(app).get(`/api/live/${code}/state`)).body.data;
const queue = (id, t) => request(app).get(`/api/presentations/${id}/moderation`).set(auth(t));
const moderate = (id, t, slideId, responseId, action) => request(app).post(`/api/presentations/${id}/moderation/${slideId}/${responseId}`).set(auth(t)).send({ action });
const mode = (id, t, m) => request(app).post(`/api/presentations/${id}/moderation/mode`).set(auth(t)).send({ mode: m });
const goTo = (id, t, slideIndex) => request(app).post(`/api/presentations/${id}/live-actions`).set(auth(t)).send({ type: 'slide:change', slideIndex });

describe('moderation', () => {
  it('shows new responses at once by default', async () => {
    const { code } = await setup();
    await say(code, 'p-aaaaaa', 'hello');
    expect((await pub(code)).slides[0].responses.map((r) => r.text)).toEqual(['hello']);
  });

  it('approval mode keeps text out of public state until approved', async () => {
    const { t, id, code } = await setup();
    await mode(id, t, 'approve');
    await say(code, 'p-aaaaaa', 'secret-pending');
    expect(JSON.stringify(await pub(code))).not.toContain('secret-pending');
    const q = (await queue(id, t)).body.data;
    expect(q.items).toHaveLength(1);
    expect(q.items[0].text).toBe('secret-pending');
    const approved = await moderate(id, t, q.items[0].slideId, q.items[0].id, 'approve');
    expect(approved.status).toBe(200);
    expect(JSON.stringify(await pub(code))).toContain('secret-pending');
    expect((await queue(id, t)).body.data.items).toHaveLength(0);
  });

  it('hide is reversible and delete clears the text', async () => {
    const { t, id, code } = await setup();
    await say(code, 'p-aaaaaa', 'rude');
    await Presentation.findById(id); // ids are stamped on add
    const doc = await Presentation.findById(id);
    const rid = doc.slides[0].responses[0].id;
    const sid = doc.slides[0].id;
    await moderate(id, t, sid, rid, 'hide');
    expect(JSON.stringify(await pub(code))).not.toContain('rude');
    expect((await queue(id, t)).body.data.items[0].status).toBe('hidden');
    await moderate(id, t, sid, rid, 'restore');
    expect(JSON.stringify(await pub(code))).toContain('rude');
    await moderate(id, t, sid, rid, 'delete');
    expect(JSON.stringify(await pub(code))).not.toContain('rude');
    expect((await queue(id, t)).body.data.items).toHaveLength(0);
    const stored = await Presentation.findById(id);
    expect(stored.slides[0].responses[0].text).toBe('');
    expect((await moderate(id, t, sid, rid, 'restore')).status).toBe(409);
    expect(JSON.stringify(stored.moderationLog)).not.toContain('rude');
    expect(stored.moderationLog.map((e) => e.action)).toEqual(['hide', 'restore', 'delete']);
  });

  it('word-cloud totals count only visible words', async () => {
    const { t, id, code } = await setup();
    await goTo(id, t, 1);
    await word(code, 'p-aaaaaa', 'ok');
    await word(code, 'p-bbbbbb', 'bad');
    let s = await pub(code);
    expect(s.slides[1].tally.total).toBe(2);
    const doc = await Presentation.findById(id);
    const bad = doc.slides[1].responses.find((r) => r.text === 'bad');
    await moderate(id, t, doc.slides[1].id, bad.id, 'hide');
    s = await pub(code);
    expect(s.slides[1].tally.total).toBe(1);
    expect(s.slides[1].tally.words).toEqual([{ text: 'ok', count: 1 }]);
    expect(JSON.stringify(s)).not.toContain('bad');
  });

  it('rejects moderation by another owner or the audience', async () => {
    const { t, id, code } = await setup();
    const other = (await request(app).post('/api/users/signup').send({ username: 'intruder', password: 'super-secret-1' })).body.token;
    await say(code, 'p-aaaaaa', 'x1');
    const doc = await Presentation.findById(id);
    const args = [id, other, doc.slides[0].id, doc.slides[0].responses[0].id, 'delete'];
    expect((await moderate(...args)).status).toBe(404);
    expect((await queue(id, other)).status).toBe(404);
    expect((await mode(id, other, 'approve')).status).toBe(404);
    expect((await request(app).post(`/api/presentations/${id}/moderation/${doc.slides[0].id}/${doc.slides[0].responses[0].id}`).send({ action: 'delete' })).status).toBe(401);
    expect((await queue(id, t)).status).toBe(200);
  });

  it('refuses an upvote on a hidden or deleted response without moving it to another', async () => {
    const { t, id, code } = await setup();
    await say(code, 'p-aaaaaa', 'first');
    await say(code, 'p-bbbbbb', 'second');
    let doc = await Presentation.findById(id);
    const sid = doc.slides[0].id;
    await moderate(id, t, sid, doc.slides[0].responses[0].id, 'delete');
    const up = await act(code, { type: 'response:upvote', slideIndex: 0, responseIndex: 0, participantId: 'p-cccccc' });
    expect(up.status).toBe(400);
    doc = await Presentation.findById(id);
    expect(doc.slides[0].responses.map((r) => r.upvotes.length)).toEqual([0, 0]);
    // the surviving response keeps its stored position as its upvote address
    const s = await pub(code);
    expect(s.slides[0].responses).toMatchObject([{ index: 1, text: 'second' }]);
    expect((await act(code, { type: 'response:upvote', slideIndex: 0, responseIndex: 1, participantId: 'p-cccccc' })).status).toBe(200);
  });

  it('a retried send of a deleted response is not resurrected', async () => {
    const { t, id, code } = await setup();
    await say(code, 'p-aaaaaa', 'again', 'client-id-1');
    const doc = await Presentation.findById(id);
    await moderate(id, t, doc.slides[0].id, doc.slides[0].responses[0].id, 'delete');
    await say(code, 'p-aaaaaa', 'again', 'client-id-1');
    expect(JSON.stringify(await pub(code))).not.toContain('again');
    expect((await Presentation.findById(id)).slides[0].responses).toHaveLength(1);
  });

  it('concurrent upvotes and moderation never restore deleted content or hit another response', async () => {
    const { t, id, code } = await setup();
    await say(code, 'p-aaaaaa', 'one');
    await say(code, 'p-bbbbbb', 'two');
    const doc = await Presentation.findById(id);
    const sid = doc.slides[0].id;
    const [r0, r1] = doc.slides[0].responses.map((r) => r.id);
    await Promise.all([
      moderate(id, t, sid, r0, 'delete'),
      ...Array.from({ length: 6 }, (_, i) => act(code, { type: 'response:upvote', slideIndex: 0, responseIndex: 1, participantId: `p-voter${i}` })),
      ...Array.from({ length: 4 }, (_, i) => act(code, { type: 'response:upvote', slideIndex: 0, responseIndex: 0, participantId: `p-late${i}` })),
    ]);
    const after = await Presentation.findById(id);
    const [a, b] = after.slides[0].responses;
    expect(a.id).toBe(r0);
    expect(a.status).toBe('deleted');
    expect(a.text).toBe('');
    expect(a.upvotes).toEqual([]);
    expect(b.id).toBe(r1);
    expect(b.upvotes).toHaveLength(6);
  });

  it('own pending word is returned to its author flagged, hidden is not', async () => {
    const { t, id, code } = await setup();
    await goTo(id, t, 1);
    await mode(id, t, 'approve');
    await word(code, 'p-aaaaaa', 'mine');
    const me = async () => (await request(app).get(`/api/live/${code}/me`).set('x-participant-id', 'p-aaaaaa')).body.data;
    expect((await me())[1]).toEqual({ word: 'mine', pending: true });
    const doc = await Presentation.findById(id);
    await moderate(id, t, doc.slides[1].id, doc.slides[1].responses[0].id, 'hide');
    expect((await me())[1]).toBeUndefined();
  });

  it('exports include only visible responses', async () => {
    const { t, id, code } = await setup();
    await say(code, 'p-aaaaaa', 'shown');
    await say(code, 'p-bbbbbb', 'hidden-one');
    const doc = await Presentation.findById(id);
    await moderate(id, t, doc.slides[0].id, doc.slides[0].responses[1].id, 'hide');
    const csv = (await request(app).get(`/api/presentations/${id}/export.csv?kind=responses`).set(auth(t))).text;
    expect(csv).toContain('shown');
    expect(csv).not.toContain('hidden-one');
  });
});
