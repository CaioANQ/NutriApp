import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const SERVER_STARTED_AT = new Date().toISOString();

const HTML_ROUTES = new Map([
  ['/', 'nutriapp-web-mvp.html'],
  ['/web', 'nutriapp-web-mvp.html'],
  ['/web/', 'nutriapp-web-mvp.html'],
  ['/admin', 'nutriapp-admin.html'],
  ['/admin/', 'nutriapp-admin.html'],
  ['/mobile', 'nutriapp-mobile-mvp.html'],
  ['/mobile/', 'nutriapp-mobile-mvp.html'],
  ['/integrado', 'nutriapp_v3_full.html'],
  ['/integrado/', 'nutriapp_v3_full.html'],
  ['/v3', 'nutriapp_v3_full.html'],
  ['/v3/', 'nutriapp_v3_full.html'],
]);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

const rateBuckets = new Map();
const authFailures = new Map();

const DEMO_USERS = [
  {
    email: 'admin@nutriapp.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'admin123',
    role: 'admin',
    name: 'Dra. Natalia Souza',
    av: 'DN',
    sub: 'CRN 3 · 12345',
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
    name: 'João Costa',
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

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === req.headers.host;
  } catch {
    return false;
  }
}

function applySecurityHeaders(res, type = 'html') {
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

  if (type === 'html') {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
      ].join('; '),
    );
    res.setHeader('Cache-Control', 'no-store');
  } else if (type === 'api') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    res.setHeader('Cache-Control', 'no-store');
  }
}

function sendJson(res, status, payload) {
  applySecurityHeaders(res, 'api');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  applySecurityHeaders(res, 'api');
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

function isLockedOut(key) {
  const record = authFailures.get(key);
  return !!record?.lockedUntil && record.lockedUntil > Date.now();
}

function recordAuthFailure(key) {
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

async function readJson(req, maxBytes = 50_000) {
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

async function handleLogin(req, res) {
  if (IS_PROD && process.env.ENABLE_DEMO_AUTH !== 'true') {
    return sendJson(res, 403, { error: 'Autenticação demo desabilitada em produção.' });
  }
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: 'Origem não permitida.' });
  }

  const ip = clientIp(req);
  const failKey = `auth:${ip}`;
  if (isLockedOut(failKey)) {
    return sendJson(res, 429, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
  }

  const body = await readJson(req, 5_000);
  const email = String(body.email || '').trim().toLowerCase();
  const passwordHash = sha256(body.password || '');
  const user = DEMO_USERS.find((item) => item.email === email);

  if (!user || !safeEqual(user.passwordHash, passwordHash)) {
    recordAuthFailure(failKey);
    return sendJson(res, 401, { error: 'Credenciais inválidas.' });
  }

  const { password, passwordHash: _passwordHash, ...safeUser } = user;
  return sendJson(res, 200, safeUser);
}

function validateAiPayload(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages.length > 20) {
    return { error: 'Envie entre 1 e 20 mensagens.' };
  }

  const safeMessages = [];
  for (const message of messages) {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(message?.content || '').trim();
    if (!content || content.length > 2_000) {
      return { error: 'Cada mensagem deve ter entre 1 e 2000 caracteres.' };
    }
    safeMessages.push({ role, content });
  }

  return {
    payload: {
      model: process.env.ANTHROPIC_MODEL || body.model || 'claude-sonnet-4-20250514',
      max_tokens: Math.min(Number(body.max_tokens || 800), 1024),
      system: String(body.system || '').slice(0, 2_000),
      messages: safeMessages,
    },
  };
}

async function handleAi(req, res) {
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: { message: 'Origem não permitida.' } });
  }

  const ip = clientIp(req);
  if (isRateLimited(`ai:${ip}`, Number(process.env.AI_RATE_LIMIT_MAX || 20), 15 * 60_000)) {
    return sendJson(res, 429, { error: { message: 'Limite de consultas à IA atingido. Aguarde.' } });
  }

  const body = await readJson(req);
  const { payload, error } = validateAiPayload(body);
  if (error) {
    return sendJson(res, 400, { error: { message: error } });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 200, {
      id: 'local-demo',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'IA protegida via backend. Configure ANTHROPIC_API_KEY no ambiente do servidor para habilitar respostas reais sem expor a chave no navegador.',
      }],
    });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await upstream.text();
  applySecurityHeaders(res, 'api');
  res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(responseBody);
}

async function serveHtml(res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  const body = await readFile(filePath);
  applySecurityHeaders(res, 'html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  const normalized = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Acesso negado.' });
  }

  const ext = path.extname(filePath);
  const body = await readFile(filePath);
  applySecurityHeaders(res, ext === '.html' ? 'html' : 'asset');
  res.writeHead(200, {
    'Content-Type': MIME_TYPES.get(ext) || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const ip = clientIp(req);

    if (isRateLimited(`global:${ip}`, Number(process.env.RATE_LIMIT_MAX || 300), 15 * 60_000)) {
      return sendJson(res, 429, { error: 'Muitas requisições. Aguarde antes de tentar novamente.' });
    }

    if (req.method === 'OPTIONS') {
      applySecurityHeaders(res, 'api');
      res.writeHead(204, { Allow: 'GET, POST, OPTIONS' });
      return res.end();
    }

    if (req.method === 'HEAD' && HTML_ROUTES.has(pathname)) {
      applySecurityHeaders(res, 'html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end();
    }

    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { status: 'ok', startedAt: SERVER_STARTED_AT });
    }

    if (req.method === 'GET' && pathname === '/favicon.ico') {
      applySecurityHeaders(res, 'asset');
      res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' });
      return res.end();
    }

    if (req.method === 'GET' && pathname === '/.well-known/security.txt') {
      return sendText(res, 200, [
        `Contact: mailto:${process.env.SECURITY_EMAIL || 'security@nutriapp.local'}`,
        `Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
        'Preferred-Languages: pt-BR, en',
        `Policy: ${process.env.PUBLIC_SECURITY_POLICY_URL || 'https://example.com/security'}`,
      ].join('\n'));
    }

    if (req.method === 'GET' && pathname === '/.well-known/dpo') {
      return sendJson(res, 200, {
        name: process.env.DPO_NAME || 'Encarregado de Dados',
        email: process.env.DPO_EMAIL || 'dpo@nutriapp.local',
        legalBasis: 'LGPD Art. 41',
      });
    }

    if (req.method === 'GET' && pathname === '/api/lgpd/my-data') {
      return sendJson(res, 200, {
        scope: 'demo-local',
        serverStoredPersonalData: [],
        note: 'Esta versão local não persiste dados pessoais no servidor. Estados do protótipo ficam apenas na sessão do navegador.',
        rights: ['confirmação de tratamento', 'acesso', 'correção', 'portabilidade', 'eliminação', 'informação sobre compartilhamento'],
      });
    }

    if (req.method === 'GET' && pathname === '/api/lgpd/consents') {
      return sendJson(res, 200, {
        termsVersion: 'demo-2026-04-23',
        privacyNotice: 'Dados de saúde são tratados como sensíveis e devem ter finalidade, base legal, minimização e controle de acesso.',
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      return await handleLogin(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/ai/messages') {
      return await handleAi(req, res);
    }

    if (req.method === 'GET' && HTML_ROUTES.has(pathname)) {
      return await serveHtml(res, HTML_ROUTES.get(pathname));
    }

    if (req.method === 'GET') {
      return await serveStatic(req, res, pathname === '/index.html' ? '/nutriapp-web-mvp.html' : pathname);
    }

    return sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (error) {
    const status = Number(error.status || 500);
    if (status === 404 || error.code === 'ENOENT') {
      return sendJson(res, 404, { error: 'Não encontrado.' });
    }
    return sendJson(res, status, { error: status === 500 ? 'Erro interno.' : error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NutriApp seguro rodando em http://${HOST}:${PORT}`);
});
