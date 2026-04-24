import { methodNotAllowed, sendOptions, sendText } from '../lib/serverless.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res, 'GET, OPTIONS');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');

  return sendText(res, 200, [
    `Contact: mailto:${process.env.SECURITY_EMAIL || 'security@nutriapp.local'}`,
    `Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
    'Preferred-Languages: pt-BR, en',
    `Policy: ${process.env.PUBLIC_SECURITY_POLICY_URL || 'https://example.com/security'}`,
  ].join('\n'));
}
