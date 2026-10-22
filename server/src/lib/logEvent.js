/**
 * One JSON line per event, for log search. Never pass tokens, participant ids or answer text.
 * Fields: ts, level, event, plus the small context object given.
 */
export function logEvent(level, event, context = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...context });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}
