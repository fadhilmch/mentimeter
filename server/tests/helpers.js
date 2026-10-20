import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';

let memory;

export async function setupTestApp() {
  memory = await MongoMemoryServer.create();
  await connectDatabase(memory.getUri());
  return createApp();
}

export async function teardownTestApp() {
  await disconnectDatabase();
  await memory.stop();
}

export async function clearCollections() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}
