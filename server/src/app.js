import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { presentationsRouter } from './routes/presentations.js';
import { liveRouter } from './routes/live.js';
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
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(',') }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', authRouter);
  app.use('/api/presentations', presentationsRouter);
  app.use('/api/live', liveRouter);

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
