import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { LiveSession } from '../src/models/liveSession.js';
import { purgeOldSessions } from '../src/lib/sessionRetention.js';

let memory;
beforeAll(async () => { memory = await MongoMemoryServer.create(); await connectDatabase(memory.getUri()); });
afterAll(async () => { await disconnectDatabase(); await memory.stop(); });

describe('session retention', () => {
  it('dry-runs, then deletes only old ended sessions', async () => {
    const base = { owner: new mongoose.Types.ObjectId(), presentation: new mongoose.Types.ObjectId(), title: 't', slides: [] };
    const old = new Date(Date.now() - 100 * 86_400_000);
    await LiveSession.create([
      { ...base, code: '100001', status: 'ended', endedAt: old },
      { ...base, code: '100002', status: 'archived', endedAt: old },
      { ...base, code: '100003', status: 'ended', endedAt: new Date() },
      { ...base, code: '100004', status: 'active' },
    ]);
    expect(await purgeOldSessions({ days: 90 })).toMatchObject({ wouldDelete: 2, deleted: 0 });
    expect(await LiveSession.countDocuments()).toBe(4);
    expect(await purgeOldSessions({ days: 90, apply: true })).toMatchObject({ deleted: 2 });
    expect((await LiveSession.find().lean()).map((s) => s.code).sort()).toEqual(['100003', '100004']);
    await expect(purgeOldSessions({ days: 0 })).rejects.toThrow(RangeError);
  });
});
