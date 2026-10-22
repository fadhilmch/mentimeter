# Live sessions: design and migration preview (brief 05)

Status: PREVIEW. The model and migration exist and are tested, but no live route uses them. Nothing here changes running behaviour, and the migration has not been run against any real database.

## Problem
A deck, its answers, its participants and its join code are one document. Running a deck again means resetting it, and the earlier run's results are gone.

## Model (`server/src/models/liveSession.js`)
- A session has an owner, a deck reference, a snapshot of the slides taken at start (with its answers), its own code, status (`active`, `ended`, `archived`), start and end times, current slide, voting and results controls, and a live revision.
- The snapshot is the unit that answers attach to. Editing the deck cannot change a running or finished session.
- A code belongs to one active session (partial unique index). Ending a session releases it, so a code may be reused later. Participant credentials must be bound to the session id (not just the code) so an old credential cannot enter a different run. That binding is part of the live-route follow-up, not this preview.

## Behaviour planned for the follow-up (not implemented)
- start: copy the deck, allocate a code (retry on unique-index collision), status active.
- repeat: start again from the same deck; the earlier session stays readable.
- end: status ended, reject HTTP and socket answers, tell connected clients.
- archive and delete: owner controls; deleting an account deletes its sessions and their participant data.
- Owner-only history routes; audience state stays audience-safe.
- Answer storage: this preview keeps answers inside the snapshot. For scale (brief 06) answers should move to a per-session answers collection with a uniqueness key of (session, slide, participant).

## Migration (`server/src/lib/sessionMigration.js`, `server/scripts/migrate-sessions.js`)
- Each existing deck becomes one legacy session that keeps its code, owner, votes, responses, ratings, rankings, reveal locks, participants and live state. Response ids are kept as stored (they exist once the moderation PR is in).
- Idempotent: a unique `legacyOf` index plus an upsert means a second run, or two at once, create nothing new.
- Dry run by default. `--apply` is required to write. The deck is never modified.
- Rollout: run the dry run, review counts, apply, then ship the routes that read sessions. Old links keep working because the legacy session keeps the deck's code.
- Rollback: stop using the sessions collection. Decks are unchanged, so nothing needs restoring. Answers collected in sessions after cut-over would not be in the deck; export them first.

## Not decided yet
Retention period for ended sessions, whether decks keep a "current session" pointer, and whether the audience page URL should include a session id.

## Lifecycle routes (flagged off by default)

With `SESSIONS_ENABLED=true`: `POST /api/presentations/:id/sessions` (start, or run again: new code, blank answers, snapshot of the deck), `GET /api/presentations/:id/sessions`, `POST /api/sessions/:sid/end`, `/archive`, `DELETE /api/sessions/:sid` (active sessions must be ended first). Owner only. Deck codes and active session codes never collide.

Still not done: audience join and live actions against a session (answers still go to the deck), session-bound participant credentials, retention/expiry, UI. Turning the flag on in production is an owner decision, after the migration dry run.
