import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Media } from '../src/models/media.js';
import { LiveSession } from '../src/models/liveSession.js';
import { Presentation } from '../src/models/presentation.js';
import { User } from '../src/models/user.js';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

describe('data hardening', () => {
  it('enables full optimistic concurrency on decks and sessions', async () => {
    expect(Presentation.schema.options.optimisticConcurrency).toBe(true);
    expect(LiveSession.schema.options.optimisticConcurrency).toBe(true);
  });

  it('account deletion also removes uploaded images and live sessions', async () => {
    const signup = await request(app).post('/api/users/signup').send({ name: 'F', username: 'fadhil', password: 'super-secret-1' }).expect(201);
    const owner = (await User.findOne({ username: 'fadhil' }))._id;
    const other = (await User.create({ name: 'O', username: 'other', passwordHash: 'x' }))._id;
    await Media.create({ owner, contentType: 'image/png', data: Buffer.from([1]) });
    await Media.create({ owner: other, contentType: 'image/png', data: Buffer.from([2]) });
    await LiveSession.collection.insertOne({ owner, code: 'ZZZ111', status: 'ended' });
    await LiveSession.collection.insertOne({ owner: other, code: 'ZZZ222', status: 'ended' });

    await request(app).delete('/api/users/me').set({ Authorization: `Bearer ${signup.body.token}` }).send({ password: 'super-secret-1' }).expect(200);

    expect(await Media.countDocuments({ owner })).toBe(0);
    expect(await LiveSession.countDocuments({ owner })).toBe(0);
    expect(await Media.countDocuments({ owner: other })).toBe(1);
    expect(await LiveSession.countDocuments({ owner: other })).toBe(1);
  });
});
