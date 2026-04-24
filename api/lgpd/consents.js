import { methodNotAllowed, sendJson, sendOptions } from '../../lib/serverless.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res, 'GET, OPTIONS');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');

  return sendJson(res, 200, {
    termsVersion: 'demo-2026-04-23',
    privacyNotice: 'Dados de saude sao tratados como sensiveis e devem ter finalidade, base legal, minimizacao e controle de acesso.',
  });
}
