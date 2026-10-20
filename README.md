# LivePoll (working title)

Open-source live audience polling - a modern rebuild of this repository's original Mentimeter-style app. Presenters build slides, the audience joins with a 6-digit code (no account needed), and results update live on the big screen.

> **Naming:** the final product name is not chosen yet. The codebase intentionally uses the neutral working title `LivePoll` in UI copy and local dev defaults; rename before public launch.

## Features

- **Two slide types**: multiple-choice polls with live bar charts, and open-ended questions where the audience submits answers and upvotes each other's.
- **6-digit join codes**: audience joins from any browser, no signup.
- **Live everywhere**: presenter screen, audience phones, and results stay in sync in real time.
- **One vote per person**: a stable anonymous participant id keeps polls honest; upvotes toggle.
- **Presenter accounts**: signup/login (JWT), create/edit/delete presentations, keep already-cast votes when editing slides.
- **Two realtime transports** (same event protocol, same UI):
  - **Socket.IO** - default, fully self-hosted and open-source.
  - **Ably** - for serverless hosting (e.g. Vercel) where a persistent WebSocket server cannot run.

## Tech stack

| Layer | Choice |
| --- | --- |
| Client | Vue 3 + TypeScript, Vite, Pinia, Vue Router, hand-rolled responsive CSS |
| Server | Node.js (>=20), Express 5, Mongoose 9, Socket.IO 4, Zod validation, Helmet, rate limiting |
| Realtime (serverless) | Ably (subscribe-only token per join code) |
| Data | MongoDB (Atlas free tier or self-hosted) |
| Tests | Vitest + Supertest + mongodb-memory-server |

## Quickstart

### One-command demo (no MongoDB install)

```bash
cd server && npm install && npm run dev:memory
```

Starts an in-memory MongoDB with seeded demo data on http://localhost:3000:

- Audience join code: **123456**
- Presenter login: **demo / demo1234**

Build the client first (`cd client && npm install && npm run build`) to have the server serve it, or run the Vite dev server alongside.

### Local development

```bash
# Terminal 1 - API + Socket.IO on :3000
cd server && npm install && cp .env.example .env
npm run dev

# Terminal 2 - Vite dev server on :5173 (proxies /api and /socket.io)
cd client && npm install && npm run dev
```

### Docker (self-hosted, all-in-one)

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

Serves API, Socket.IO and the built client on http://localhost:3000 with a persistent MongoDB volume.

## Deployment

### Self-hosted (default)

Any Node host works: build the client, set `CLIENT_DIST`, and the Express server serves the UI plus Socket.IO:

```bash
cd client && npm run build
cd ../server && MONGODB_URI=... JWT_SECRET=... CLIENT_DIST=../client/dist npm start
```

### Vercel + Ably + MongoDB Atlas (serverless)

1. Create a free [Ably](https://ably.com) app and copy its root API key.
2. Create a free [MongoDB Atlas](https://www.mongodb.com/pricing) M0 cluster and a connection string.
3. Import this repo into Vercel (`vercel.json` is included) and set environment variables:
   - `MONGODB_URI` - Atlas connection string
   - `JWT_SECRET` - long random string
   - `ABLY_API_KEY` - Ably root key
   - `CLIENT_ORIGIN` - your deployment origin (or `*`)
4. Set `VITE_LIVE_MODE=ably` so the client uses the Ably transport (mutations go over HTTP, state arrives over Ably).

The `api/index.js` serverless entry reuses the same Express app with a cached Mongo connection. Persistent Socket.IO is not available on Vercel; the Ably path exists for exactly that case.

## Environment variables

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). Nothing secret is committed; `JWT_SECRET` and `MONGODB_URI` are required in production and the server refuses to boot without them.

## Architecture

```
client/            Vue 3 SPA
  src/live/        Transport interface + Socket.IO and Ably implementations
  src/stores/      Pinia stores (auth, live session)
server/
  src/lib/         Pure, unit-tested logic: access codes, results/tallies, live actions
  src/routes/      REST: auth, presentations CRUD, live HTTP endpoints (Ably mode)
  src/sockets/     Socket.IO room protocol (self-hosted mode)
  src/models/      Mongoose schemas (User, Presentation)
api/index.js       Vercel serverless entry (HTTP API only)
```

Both realtime transports share one action vocabulary (`slide:change`, `vote:cast`, `response:add`, `response:upvote`) validated with Zod on the server. State broadcasts are audience-safe snapshots - vote identities and response authors never leave the server.

## Testing

```bash
cd server && npm test          # 18 tests: access codes, tallies, live actions, auth, REST, sockets
cd client && npm run typecheck # vue-tsc strict typecheck
```

Business logic (code generation, tally math, vote/upvote rules) lives in pure functions under `server/src/lib/` and is covered by unit tests independent of Express or MongoDB.

## Security notes

- Passwords hashed with bcrypt; JWT auth with a required secret in production.
- Helmet headers, CORS allowlist, JSON body limits, rate-limited auth endpoints.
- All inputs validated with Zod; audience-visible state strips voter identities.
- Audience actions are keyed by join code: anyone with the code can vote. Presenter controls (edit, delete) require the owner account.

## Roadmap / open decisions

- Final product name and domain (working title in use)
- License selection
- Presenter-only slide control (currently anyone with the code can advance slides)
- Optional per-presentation audience authentication

## Credits

Originally inspired by [Mentimeter](https://www.mentimeter.com). Rebuilt in 2026 with a modern stack, preserving the original feature set.
