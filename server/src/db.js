import mongoose from 'mongoose';
import { config } from './config.js';

// Cache the connection across serverless invocations (Vercel reuses lambdas).
const cache = (globalThis.__mongooseCache ??= { conn: null, promise: null });

export async function connectDatabase(uri = config.mongoUri) {
  if (cache.conn) return cache.conn;
  mongoose.set('strictQuery', true);
  cache.promise ??= mongoose.connect(uri);
  cache.conn = await cache.promise;
  await ensureIndexes();
  return cache.conn;
}

/**
 * Wait until every model's indexes exist. Mongoose builds indexes in the background after connecting,
 * and several guards (duplicate email, duplicate username, duplicate Firebase uid) rely on a unique index
 * to raise error 11000. Without this wait, a request that arrives first can slip past the guard.
 * Creating an index that already exists is a no-op, so this is cheap on warm starts.
 */
export async function ensureIndexes() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
