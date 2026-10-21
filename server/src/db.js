import mongoose from 'mongoose';
import { config } from './config.js';

// Cache the connection across serverless invocations (Vercel reuses lambdas).
const cache = (globalThis.__mongooseCache ??= { conn: null, promise: null });

export async function connectDatabase(uri = config.mongoUri) {
  if (cache.conn) return cache.conn;
  mongoose.set('strictQuery', true);
  cache.promise ??= mongoose.connect(uri);
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
