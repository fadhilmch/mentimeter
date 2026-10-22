// Voting-burst load test against an in-memory server (Socket.IO transport, one process).
// Usage: node scripts/load-test.js [50 100 250]
// It measures ack latency, lost or duplicated accepted answers, a presenter closing voting mid-burst,
// and bytes broadcast per action. In-memory MongoDB on one machine is NOT the production
// topology: numbers are a method and a floor for comparison, not a supported audience size.
import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { registerPresentationSockets } from '../src/sockets/presentation.js';
import { Presentation } from '../src/models/presentation.js';
import { User } from '../src/models/user.js';

process.env.LIVE_ACTIONS_PER_IP_PER_MIN = '1000000';
process.env.LIVE_ANSWERS_PER_10S = '1000';

const sizes = process.argv.slice(2).map(Number).filter(Boolean);
const audienceSizes = sizes.length ? sizes : [50, 100, 250];
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const memory = await MongoMemoryServer.create();
await connectDatabase(memory.getUri());
const app = createApp();
const http = createServer(app);
const io = new Server(http);
registerPresentationSockets(io);
await new Promise((r) => http.listen(0, r));
const port = http.address().port;
const owner = await User.create({ name: 'L', username: 'load', passwordHash: 'x' });

async function run(n, { closeAfter }) {
  const code = String(100000 + n + (closeAfter ? 1 : 0));
  await Presentation.create({
    owner: owner._id, title: `load ${n}`, accessCode: code,
    slides: [{ id: 's1', questionType: 'multiple-choice', question: 'Q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] }],
  });
  const sockets = await Promise.all(Array.from({ length: n }, async () => {
    const s = clientIo(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
    await new Promise((r) => s.on('connect', r));
    await new Promise((r) => s.emit('presentation:join', { accessCode: code }, r));
    return s;
  }));
  let broadcastBytes = 0;
  let broadcasts = 0;
  sockets[0].on('presentation:state', (st) => { broadcasts += 1; broadcastBytes += Buffer.byteLength(JSON.stringify(st)); });

  const latencies = [];
  const results = { accepted: 0, rejected: 0, errors: 0 };
  const errorMessages = {};
  const fire = (s, i) => new Promise((resolve) => {
    const t0 = performance.now();
    s.emit('live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: i % 3, participantId: `p-load-${i}` }, (ack) => {
      latencies.push(performance.now() - t0);
      if (ack?.ok) results.accepted += 1;
      else if (/closed/i.test(ack?.message ?? '')) results.rejected += 1;
      else { results.errors += 1; errorMessages[ack?.message ?? 'no ack'] = (errorMessages[ack?.message ?? 'no ack'] ?? 0) + 1; }
      resolve();
    });
  });
  const burst = Promise.all(sockets.map((s, i) => fire(s, i)));
  if (closeAfter) {
    await new Promise((r) => setTimeout(r, closeAfter));
    await Presentation.updateOne({ accessCode: code }, { $set: { votingOpen: false } }); // direct write: presenter route needs auth
  }
  const started = performance.now();
  await burst;
  const wall = performance.now() - started;
  await new Promise((r) => setTimeout(r, 300));
  const doc = await Presentation.findOne({ accessCode: code }).lean();
  const stored = doc.slides[0].options.reduce((sum, o) => sum + o.votes.length, 0);
  const distinct = new Set(doc.slides[0].options.flatMap((o) => o.votes)).size;
  sockets.forEach((s) => s.close());
  latencies.sort((a, b) => a - b);
  return {
    audience: n, closeMidBurst: Boolean(closeAfter), errorMessages, accepted: results.accepted, rejectedClosed: results.rejected, errors: results.errors,
    storedVotes: stored, distinctVoters: distinct, lostAcceptedAnswers: results.accepted - stored, duplicates: stored - distinct,
    p50ms: Math.round(pct(latencies, 50)), p95ms: Math.round(pct(latencies, 95)), p99ms: Math.round(pct(latencies, 99)), maxMs: Math.round(latencies.at(-1)),
    burstWallMs: Math.round(wall), broadcastsSeenByOneClient: broadcasts, avgBroadcastBytes: broadcasts ? Math.round(broadcastBytes / broadcasts) : 0,
    bytesToAllClientsPerAction: broadcasts ? Math.round((broadcastBytes / broadcasts) * n) : 0,
  };
}

const rows = [];
for (const n of audienceSizes) rows.push(await run(n, {}));
rows.push(await run(audienceSizes.at(-1), { closeAfter: 40 }));
console.log(JSON.stringify({ node: process.version, cpus: (await import('node:os')).cpus().length, rows }, null, 2));
io.close(); http.close(); await disconnectDatabase(); await memory.stop();
