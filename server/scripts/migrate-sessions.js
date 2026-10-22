// Preview of the deck -> live session migration. Writes nothing unless --apply is passed.
// Usage: MONGODB_URI=... node scripts/migrate-sessions.js            (dry run, prints counts)
//        MONGODB_URI=... node scripts/migrate-sessions.js --apply    (creates missing legacy sessions)
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { LiveSession } from '../src/models/liveSession.js';
import { migrateLegacySessions } from '../src/lib/sessionMigration.js';

if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
await connectDatabase(process.env.MONGODB_URI);
await LiveSession.init();
console.log(JSON.stringify(await migrateLegacySessions({ apply }), null, 2));
await disconnectDatabase();
