import { methodNotAllowed, sendJson, sendOptions } from '../lib/serverless.js';

const startedAt = new Date().toISOString();

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res, 'GET, OPTIONS');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');

  return sendJson(res, 200, {
    status: 'ok',
    runtime: 'vercel',
    startedAt,
  });
}
