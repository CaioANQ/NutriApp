// backend/src/modules/ai/ai.service.ts
// Módulo de IA — chave Anthropic NUNCA exposta ao frontend
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../../utils/errors';
import { auditLog } from '../../utils/audit';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

/**
 * Consulta a IA com histórico de conversa acumulado.
 * Streaming: retorna gerador async para resposta progressiva.
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

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    await auditLog({
      userId,
      action: 'DATA_ACCESS',
      resource: 'ai_consultation',
      ipAddress,
      success: true,
      metadata: { messageCount: messages.length },
    });
  } catch (err: any) {
    if (err.status === 429) {
      throw new AppError('Limite de consultas à IA atingido. Aguarde.', 429);
    }
    throw new AppError('Erro ao consultar a IA. Tente novamente.', 502);
  }
}

/**
 * Sugestão de cardápio inteligente com alimentos da estação
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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  await auditLog({ userId, action: 'DATA_ACCESS', resource: 'ai_seasonal', success: true });

  return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}
