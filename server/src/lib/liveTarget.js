import { Presentation } from '../models/presentation.js';
import { LiveSession } from '../models/liveSession.js';

/**
 * What a join code points at. With SESSIONS_ENABLED=true an active session wins; otherwise (and for
 * decks that have no active session) it is the deck itself, which is today's behaviour.
 * The flag is read per call so tests and operators can flip it without a restart of the module graph.
 */
const sessionsOn = () => process.env.SESSIONS_ENABLED === 'true';

export async function findLiveByCode(code) {
  if (sessionsOn()) {
    const session = await LiveSession.findOne({ code, status: 'active' });
    if (session) return session;
  }
  return Presentation.findOne({ accessCode: code });
}

export async function liveExistsByCode(code) {
  if (sessionsOn() && (await LiveSession.exists({ code, status: 'active' }))) return true;
  return Boolean(await Presentation.exists({ accessCode: code }));
}
