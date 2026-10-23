import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { firebaseEnabled, firebaseConnectSources, firebaseFrameSources } from './lib/firebase.js';
import { authRouter } from './routes/auth.js';
import { presentationsRouter } from './routes/presentations.js';
import { liveRouter } from './routes/live.js';
import { sessionsRouter } from './routes/sessions.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  // Helmet's default CSP, widened only for images: presenters can add an external
  // HTTPS image to a slide. Scripts, styles, frames and connections stay locked down.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': ["'self'", 'data:', 'https:'],
          // Firebase sign-in runs in the browser and talks to Google (or the local emulator).
          // The Google popup also loads a helper frame from the project's auth domain.
          ...(firebaseEnabled()
            ? { 'connect-src': firebaseConnectSources(), 'frame-src': ["'self'", ...firebaseFrameSources()] }
            : {}),
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(',') }));
  app.use(express.json({ limit: '256kb' }));

  // Liveness: the process is up. Says nothing about the database.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  // Readiness: the database answers. Use this for load balancer or orchestrator checks.
  app.get('/api/ready', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('not connected');
      await mongoose.connection.db.admin().ping();
      return res.json({ status: 'ready' });
    } catch {
      return res.status(503).json({ status: 'unavailable' });
    }
  });
  app.get('/api/features', (_req, res) => res.json({ sessions: process.env.SESSIONS_ENABLED === 'true' }));
  app.use('/api/users', authRouter);
  app.use('/api/presentations', presentationsRouter);
  app.use('/api/live', liveRouter);
  // Off unless explicitly enabled: see docs/live-sessions.md.
  if (process.env.SESSIONS_ENABLED === 'true') app.use('/api', sessionsRouter);

  // Self-hosted single-port mode: serve the built client when present.
  const clientDist = process.env.CLIENT_DIST
    ? join(process.cwd(), process.env.CLIENT_DIST)
    : new URL('../../client/dist', import.meta.url).pathname;
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
