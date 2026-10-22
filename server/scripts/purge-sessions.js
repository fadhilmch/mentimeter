// node scripts/purge-sessions.js --days 90 [--apply]   (dry run unless --apply)
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { purgeOldSessions } from '../src/lib/sessionRetention.js';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]);
if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}
await connectDatabase(process.env.MONGODB_URI);
try {
  console.log(JSON.stringify(await purgeOldSessions({ days, apply: args.includes('--apply') })));
} finally {
  await disconnectDatabase();
}
