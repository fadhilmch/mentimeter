# Contributing to CrowdFlow

Thanks for helping build CrowdFlow. This page covers setup, testing and pull requests.

## Setup

See the [README](README.md#quickstart). You need Node.js >= 20; MongoDB is only required for the full local setup (the `dev:memory` demo and the test suite use an in-memory MongoDB).

## Project layout

The [architecture section](README.md#architecture) maps the directories. In short: `client/` is the Vue 3 + TypeScript app, `server/` is the Express + MongoDB API with two realtime transports (Socket.IO and Ably) sharing one action vocabulary.

## Before you open a pull request

```bash
cd server && npm test          # vitest suite
cd ../client && npm run typecheck && npm test && npm run build
```

CI runs these same checks on every pull request; please keep it green.

## Conventions

- Business logic (access codes, tally math, vote/upvote rules) lives in pure functions under `server/src/lib/` with unit tests that need no Express or MongoDB. Keep framework code at the edges.
- Validate every input with Zod on the server. Audience-visible broadcasts must stay audience-safe: vote identities and response authors never leave the server.
- Colours and other visual values come from tokens, never literals in components. See the [design system](docs/DESIGN_SYSTEM.md). UI pull requests should include light and dark screenshots.
- The client is TypeScript in strict mode; avoid new `any`.
- Realtime changes must work over both transports (Socket.IO self-hosted and Ably serverless) using the shared action vocabulary.
- Never commit secrets. Copy `.env.example` to `.env` for local values; production secrets come from the host's environment.

## Naming note

The product was developed under the working title `LivePoll`, and some internal identifiers still use it (browser storage keys, local database names). Please don't rename those in passing; they need a migration plan and are tracked separately.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, what happened, and your browser and Node.js versions.
