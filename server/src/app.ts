import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes, { BACKUP_RESTORE_PATH } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a hosting proxy (Render, etc.) so rate limiting sees the real client IP
  if (isProduction) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  // Small JSON bodies everywhere except backup restore, which parses its own (larger) body
  const json = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path === `/api${BACKUP_RESTORE_PATH}` ? next() : json(req, res, next)));
  if (env.NODE_ENV !== 'test') app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', routes);
  app.use('/api', notFound);

  // In production, serve the built React app from the same origin
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (isProduction && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '7d', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
