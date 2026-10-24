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

export const SESSION_ENDED_MESSAGE = 'This session has ended. Ask the presenter for a new code.';

/**
 * True when a code once belonged to a session that has since ended and nothing live uses it now.
 * Only that fact is revealed, never any of the session's data. A code that a new active session
 * (or a deck) has taken over resolves normally, so code reuse keeps working.
 */
export async function endedByCode(code) {
  if (!sessionsOn()) return false;
  if (await liveExistsByCode(code)) return false;
  return Boolean(await LiveSession.exists({ code, status: { $in: ['ended', 'archived'] } }));
}

/** Sends the right "nothing here" answer: 410 for an ended session's code, 404 for an unknown one. */
export async function sendCodeMissing(res, code) {
  if (await endedByCode(code)) return res.status(410).json({ message: SESSION_ENDED_MESSAGE, code: 'session_ended' });
  return res.status(404).json({ message: 'No presentation with that code' });
}
