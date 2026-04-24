import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const rateBuckets = new Map();
const authFailures = new Map();

const DEMO_USERS = [
  {
    email: 'admin@nutriapp.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'admin123',
    role: 'admin',
    name: 'Dra. Natalia Souza',
    av: 'DN',
    sub: 'CRN 3 - 12345',
  },
  {
    email: 'maria@nutriapp.com',
    password: process.env.DEMO_PATIENT_PASSWORD || 'maria123',
    role: 'patient',
    name: 'Maria Silva',
    pid: 1,
  },
  {
    email: 'joao@nutriapp.com',
    password: process.env.DEMO_JOAO_PASSWORD || 'joao123',
    role: 'patient',
    name: 'Joao Costa',
    pid: 2,
  },
  {
    email: 'ana@nutriapp.com',
    password: process.env.DEMO_ANA_PASSWORD || 'ana123',
    role: 'patient',
    name: 'Ana Ferreira',
    pid: 3,
  },
].map((user) => ({ ...user, passwordHash: sha256(user.password) }));

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost || req.headers.host || '').split(',')[0].trim();

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export function applySecurityHeaders(res, type = 'api') {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  );
  res.setHeader('X-Request-ID', randomUUID());
  res.setHeader('Cache-Control', 'no-store');

  if (type === 'api') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
  }
}

export function sendJson(res, status, payload) {
  applySecurityHeaders(res, 'api');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  applySecurityHeaders(res, 'api');
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.end(body);
}

export function sendOptions(res, methods = 'GET, POST, OPTIONS') {
  applySecurityHeaders(res, 'api');
  res.statusCode = 204;
  res.setHeader('Allow', methods);
  res.end();
}

export function methodNotAllowed(res, methods) {
  applySecurityHeaders(res, 'api');
  res.statusCode = 405;
  res.setHeader('Allow', methods);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Metodo nao permitido.' }));
}

export function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

export function isLockedOut(key) {
  const record = authFailures.get(key);
  return !!record?.lockedUntil && record.lockedUntil > Date.now();
}

export function recordAuthFailure(key) {
  const now = Date.now();
  const current = authFailures.get(key);
  const stale = !current || current.firstAt + 15 * 60_000 < now;
  const next = stale ? { count: 1, firstAt: now } : { ...current, count: current.count + 1 };
  if (next.count >= 5) {
    const minutes = Math.min(60, 2 ** Math.min(next.count - 5, 5));
    next.lockedUntil = now + minutes * 60_000;
  }
  authFailures.set(key, next);
}

export async function readJson(req, maxBytes = 50_000) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
  }

  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error('Payload muito grande.');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function authenticateDemoUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const passwordHash = sha256(password || '');
  const user = DEMO_USERS.find((item) => item.email === normalizedEmail);

  if (!user || !safeEqual(user.passwordHash, passwordHash)) {
    return null;
  }

  const { password: _password, passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function handleApiError(res, error) {
  const status = Number(error?.status || (error instanceof SyntaxError ? 400 : 500));
  const message = status === 500 ? 'Erro interno.' : error.message;
  return sendJson(res, status, { error: message });
}
