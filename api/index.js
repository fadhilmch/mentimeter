// Vercel serverless entry: HTTP API only (use the Ably live transport here;
// persistent Socket.IO needs the self-hosted server).
import { createApp } from '../server/src/app.js';
import { connectDatabase } from '../server/src/db.js';

export default async function handler(req, res) {
  await connectDatabase();
  return createApp()(req, res);
}
