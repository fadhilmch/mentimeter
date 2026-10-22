import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

const seed = async () => {
  const owner = await User.create({ name: 'P', username: 'rev', passwordHash: 'x' });
  return Presentation.create({
    owner: owner._id, title: 'T', accessCode: '424242',
    slides: [{ questionType: 'multiple-choice', question: 'Q', options: [{ text: 'A', votes: [] }, { text: 'B', votes: [] }], responses: [] }],
  });
};
const state = async () => (await request(app).get('/api/live/424242/state')).body.data;
const vote = (id, option = 0) => request(app).post('/api/live/424242/action').send({ type: 'vote:cast', slideIndex: 0, optionIndex: option, participantId: id });

describe('live state revision', () => {
  it('starts at 0 and increases with every accepted change', async () => {
    await seed();
    expect((await state()).revision).toBe(0);
    await vote('p-one-aaa');
    const r1 = (await state()).revision;
    await vote('p-two-bbb');
    const r2 = (await state()).revision;
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(r1);
  });

  it('does not move on a refused action or a plain read', async () => {
    await seed();
    await vote('p-one-aaa');
    const before = (await state()).revision;
    await request(app).post('/api/live/424242/action').send({ type: 'vote:cast', slideIndex: 5, optionIndex: 0, participantId: 'p-one-aaa' });
    await state();
    expect((await state()).revision).toBe(before);
  });

  it('is never lost or repeated under concurrent answers', async () => {
    await seed();
    await Promise.all(Array.from({ length: 20 }, (_, i) => vote(`p-user-${String(i).padStart(3, '0')}`, i % 2)));
    const doc = await Presentation.findOne({ accessCode: '424242' });
    expect(doc.slides[0].options[0].votes.length + doc.slides[0].options[1].votes.length).toBe(20);
    expect(doc.liveRevision).toBeGreaterThanOrEqual(20);
  });
});
