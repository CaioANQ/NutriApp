// backend/src/index.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import { logger } from './utils/logger';
import { corsOptions } from './config/security';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestId } from './middleware/requestId.middleware';

// Routers
import authRouter from './modules/auth/auth.router';
import patientsRouter from './modules/patients/patients.router';
import mealPlansRouter from './modules/meal-plans/meal-plans.router';
import diaryRouter from './modules/diary/diary.router';
import feedbackRouter from './modules/feedback/feedback.router';
import reportsRouter from './modules/reports/reports.router';
import tacoRouter from './modules/taco/taco.router';
import aiRouter from './modules/ai/ai.router';
import lgpdRouter from './modules/lgpd/lgpd.router';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── SECURITY MIDDLEWARE ───────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10kb' }));      // Previne payload bombing
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(requestId);

// ─── LOGGING ──────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/health',
}));

// ─── RATE LIMITING ─────────────────────────────────────────────────────────────
app.use(globalRateLimiter);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/patients`, patientsRouter);
app.use(`${API_PREFIX}/meal-plans`, mealPlansRouter);
app.use(`${API_PREFIX}/diary`, diaryRouter);
app.use(`${API_PREFIX}/feedback`, feedbackRouter);
app.use(`${API_PREFIX}/reports`, reportsRouter);
app.use(`${API_PREFIX}/taco`, tacoRouter);
app.use(`${API_PREFIX}/ai`, aiRouter);
app.use(`${API_PREFIX}/lgpd`, lgpdRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`NutriApp Backend rodando na porta ${PORT} [${process.env.NODE_ENV}]`);
});

export default app;
