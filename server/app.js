import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { errorHandler } from './middleware/errors.js';
import { originGuard } from './middleware/origin.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy:
        env.nodeEnv === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                workerSrc: ["'self'", 'blob:'],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", 'data:'],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'", 'wss:'],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: env.nodeEnv === 'production' ? undefined : false,
    }),
  );
  app.use(cookieParser());
  app.use('/api', originGuard, express.json({ limit: '4mb' }), (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database-unavailable' }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 6000,
      skip: () => env.nodeEnv === 'test',
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many requests. Please retry shortly.' },
    }),
    api,
  );
  app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
  const dist = fileURLToPath(new URL('../client/dist/', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(`${dist}/index.html`));
  } else
    app.get('/', (req, res) =>
      res
        .type('text')
        .send(
          'CodeArena API is running. Use npm run dev for the frontend, or npm run build then npm start.',
        ),
    );
  app.use(errorHandler);
  return app;
}
