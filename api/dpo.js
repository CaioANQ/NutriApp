import { methodNotAllowed, sendJson, sendOptions } from '../lib/serverless.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res, 'GET, OPTIONS');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');

  return sendJson(res, 200, {
    name: process.env.DPO_NAME || 'Encarregado de Dados',
    email: process.env.DPO_EMAIL || 'dpo@nutriapp.local',
    legalBasis: 'LGPD Art. 41',
  });
}
