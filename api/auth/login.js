import {
  authenticateDemoUser,
  clientIp,
  handleApiError,
  isLockedOut,
  isRateLimited,
  methodNotAllowed,
  readJson,
  recordAuthFailure,
  sameOrigin,
  sendJson,
  sendOptions,
} from '../../lib/serverless.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return sendOptions(res, 'POST, OPTIONS');
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');

    if (process.env.VERCEL_ENV === 'production' && process.env.ENABLE_DEMO_AUTH !== 'true') {
      return sendJson(res, 403, { error: 'Autenticacao demo desabilitada em producao.' });
    }

    if (!sameOrigin(req)) {
      return sendJson(res, 403, { error: 'Origem nao permitida.' });
    }

    const ip = clientIp(req);
    const failKey = `auth:${ip}`;
    if (isRateLimited(`auth-window:${ip}`, Number(process.env.AUTH_RATE_LIMIT_MAX || 20), 15 * 60_000)) {
      return sendJson(res, 429, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    }
    if (isLockedOut(failKey)) {
      return sendJson(res, 429, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    }

    const body = await readJson(req, 5_000);
    const user = authenticateDemoUser(body.email, body.password);
    if (!user) {
      recordAuthFailure(failKey);
      return sendJson(res, 401, { error: 'Credenciais invalidas.' });
    }

    return sendJson(res, 200, user);
  } catch (error) {
    return handleApiError(res, error);
  }
}
