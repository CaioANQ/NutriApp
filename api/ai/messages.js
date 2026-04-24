import {
  clientIp,
  handleApiError,
  isRateLimited,
  methodNotAllowed,
  readJson,
  sameOrigin,
  sendJson,
  sendOptions,
} from '../../lib/serverless.js';

function validateAiPayload(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const requestedMaxTokens = Number(body.max_tokens || body.max_output_tokens || 800);
  const maxOutputTokens = Number.isFinite(requestedMaxTokens)
    ? Math.min(Math.max(requestedMaxTokens, 1), 1024)
    : 800;

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
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      maxOutputTokens,
      system: String(body.system || '').slice(0, 2_000),
      messages: safeMessages,
    },
  };
}

function toOpenAiInput(payload) {
  const input = [];
  if (payload.system) {
    input.push({
      type: 'message',
      role: 'developer',
      content: [{ type: 'input_text', text: payload.system }],
    });
  }

  for (const message of payload.messages) {
    input.push({
      type: 'message',
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    });
  }

  return input;
}

function extractOpenAiText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return sendOptions(res, 'POST, OPTIONS');
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');

    if (!sameOrigin(req)) {
      return sendJson(res, 403, { error: { message: 'Origem nao permitida.' } });
    }

    const ip = clientIp(req);
    if (isRateLimited(`ai:${ip}`, Number(process.env.AI_RATE_LIMIT_MAX || 20), 15 * 60_000)) {
      return sendJson(res, 429, { error: { message: 'Limite de consultas a IA atingido. Aguarde.' } });
    }

    const body = await readJson(req);
    const { payload, error } = validateAiPayload(body);
    if (error) {
      return sendJson(res, 400, { error: { message: error } });
    }

    if (!process.env.OPENAI_API_KEY) {
      return sendJson(res, 200, {
        id: 'local-demo',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'IA protegida via backend. Configure OPENAI_API_KEY no ambiente do servidor para habilitar respostas reais sem expor a chave no navegador.',
        }],
      });
    }

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: payload.model,
        input: toOpenAiInput(payload),
        max_output_tokens: payload.maxOutputTokens,
      }),
    });

    const responseBody = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      parsed = null;
    }

    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        error: {
          message: parsed?.error?.message || 'Erro ao consultar a OpenAI.',
        },
      });
    }

    return sendJson(res, 200, {
      id: parsed?.id || 'openai-response',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: extractOpenAiText(parsed) || 'A OpenAI retornou uma resposta sem texto.',
      }],
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
