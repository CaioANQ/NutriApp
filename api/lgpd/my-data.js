import { methodNotAllowed, sendJson, sendOptions } from '../../lib/serverless.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res, 'GET, OPTIONS');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');

  return sendJson(res, 200, {
    scope: 'vercel-demo',
    serverStoredPersonalData: [],
    note: 'Esta versao demonstrativa nao persiste dados pessoais no servidor. Estados do prototipo ficam apenas na sessao do navegador.',
    rights: [
      'confirmacao de tratamento',
      'acesso',
      'correcao',
      'portabilidade',
      'eliminacao',
      'informacao sobre compartilhamento',
    ],
  });
}
