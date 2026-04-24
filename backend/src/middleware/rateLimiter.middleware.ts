// backend/src/middleware/rateLimiter.middleware.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 min
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

const rateLimitHandler = (_req: Request, res: Response) => {
  res.status(429).json({
    error: 'Muitas requisições. Aguarde antes de tentar novamente.',
    retryAfter: Math.ceil(windowMs / 1000),
  });
};

/** Rate limiter global — 100 req/15min por IP */
export const globalRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.path === '/health',
});

/** Rate limiter estrito para autenticação — 5 tentativas/15min por IP */
export const authRateLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Muitas tentativas de login. Aguarde 15 minutos.',
    });
  },
  skipSuccessfulRequests: true,
});

/** Rate limiter para IA — 20 req/15min por usuário */
export const aiRateLimiter = rateLimit({
  windowMs,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
