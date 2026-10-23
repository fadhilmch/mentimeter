import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { User } from '../src/models/user.js';

describe('Unique indexes are ready as soon as the database connects', () => {
  let memory;
  beforeAll(async () => {
    memory = await MongoMemoryServer.create();
    await connectDatabase(memory.getUri());
  });
  afterAll(async () => {
    await disconnectDatabase();
    await memory.stop();
  });

  it('has the unique email index before the first request', async () => {
    const indexes = await User.collection.indexes();
    const email = indexes.find((i) => i.key.email === 1);
    expect(email?.unique).toBe(true);
  });

  it('rejects a duplicate email on the very first inserts', async () => {
    await User.create({ name: 'A', username: 'fb-a', firebaseUid: 'u1', email: 'x@example.com' });
    await expect(User.create({ name: 'B', username: 'fb-b', firebaseUid: 'u2', email: 'x@example.com' })).rejects.toMatchObject({ code: 11000 });
  });
});
