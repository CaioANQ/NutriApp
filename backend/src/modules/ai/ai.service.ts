// backend/src/modules/ai/ai.service.ts
// Módulo de IA — chave OpenAI NUNCA exposta ao frontend
import { AppError } from '../../utils/errors';
import { auditLog } from '../../utils/audit';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

const SYSTEM_PROMPT = `Você é uma especialista em nutrição clínica funcional e medicina integrativa com PhD. 
Você auxilia nutricionistas registrados no Brasil (CRN) com consultas técnicas baseadas em evidências científicas recentes.

Ao responder sobre alimentos terapêuticos para uma patologia, sempre inclua:
1. **Motivo da indicação** — por que esse alimento é relevante para a condição
2. **Composto bioativo principal** — nome técnico do nutriente/fitoquímico responsável  
3. **Mecanismo de ação bioquímico** — como atua no organismo (receptores, vias metabólicas)
4. **Quantidade/forma de consumo sugerida** — baseada em evidências disponíveis

Use linguagem técnica adequada para profissional de saúde. Seja conciso (máx 350 palavras).
Nunca forneça diagnósticos ou prescrições médicas — apenas apoio nutricional ao profissional.`;

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

function toOpenAiInput(messages: AIMessage[], system = SYSTEM_PROMPT) {
  return [
    {
      type: 'message',
      role: 'developer',
      content: [{ type: 'input_text', text: system }],
    },
    ...messages.map((message) => ({
      type: 'message',
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  ];
}

function extractOutputText(data: any): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('');
}

async function createOpenAiText(messages: AIMessage[], maxOutputTokens: number): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError('OPENAI_API_KEY não configurada no servidor.', 500);
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: toOpenAiInput(messages),
      max_output_tokens: maxOutputTokens,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError('Limite de consultas à IA atingido. Aguarde.', 429);
    }
    throw new AppError(body?.error?.message || 'Erro ao consultar a OpenAI.', 502);
  }

  return extractOutputText(body) || 'A OpenAI retornou uma resposta sem texto.';
}

/**
 * Consulta a IA com histórico de conversa acumulado.
 * Mantém assinatura async generator para compatibilidade com os routers existentes.
 */
export async function* consultAI(
  messages: AIMessage[],
  userId: string,
  ipAddress: string,
): AsyncGenerator<string> {
  if (!messages.length) throw new AppError('Mensagem não fornecida.', 400);

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.content.length > 2000) {
    throw new AppError('Mensagem muito longa (máx. 2000 caracteres).', 400);
  }

  const text = await createOpenAiText(messages, 1024);
  yield text;

  await auditLog({
    userId,
    action: 'DATA_ACCESS',
    resource: 'ai_consultation',
    ipAddress,
    success: true,
    metadata: { messageCount: messages.length, provider: 'openai', model: OPENAI_MODEL },
  });
}

/**
 * Sugestão de cardápio inteligente com alimentos da estação.
 */
export async function suggestSeasonalMenu(
  patientConditions: string[],
  targetKcal: number,
  userId: string,
): Promise<string> {
  const month = new Date().toLocaleString('pt-BR', { month: 'long' });

  const prompt = `Paciente com condições: ${patientConditions.join(', ')}.
Meta calórica: ${targetKcal} kcal/dia. Mês atual: ${month} (outono/inverno no Brasil).
Sugira 5 alimentos sazonais deste período que sejam terapêuticos para as condições listadas.
Para cada alimento: nome, benefício específico e uma forma simples de incluir na dieta.
Máximo 200 palavras. Seja prático e direto.`;

  const text = await createOpenAiText([{ role: 'user', content: prompt }], 600);

  await auditLog({
    userId,
    action: 'DATA_ACCESS',
    resource: 'ai_seasonal',
    success: true,
    metadata: { provider: 'openai', model: OPENAI_MODEL },
  });

  return text;
}
