// backend/src/modules/diary/diary.service.ts
// Diário do paciente — uma entrada por dia, criptografada (LGPD)
import { prisma } from '../../config/database';
import { encrypt, decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/errors';
import { auditLog } from '../../utils/audit';
import type { DiaryUpsertInput } from './diary.schema';

/**
 * Salva ou atualiza a entrada do diário do dia.
 * Apenas um registro por dia é permitido (restrição de negócio + unique constraint).
 */
export async function upsertDiaryEntry(
  patientId: string,
  userId: string,
  input: DiaryUpsertInput,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Criptografar texto antes de persistir
  const textEncrypted = encrypt(input.text.trim());

  const entry = await prisma.diaryEntry.upsert({
    where: {
      patientId_entryDate: {
        patientId,
        entryDate: today,
      },
    },
    update: {
      textEncrypted,
      moodEmoji: input.moodEmoji ?? null,
      checkedFoodIds: input.checkedFoodIds ?? [],
      waterConsumedMl: input.waterConsumedMl ?? 0,
      updatedAt: new Date(),
    },
    create: {
      patientId,
      entryDate: today,
      textEncrypted,
      moodEmoji: input.moodEmoji ?? null,
      checkedFoodIds: input.checkedFoodIds ?? [],
      waterConsumedMl: input.waterConsumedMl ?? 0,
    },
  });

  await auditLog({
    userId,
    action: 'DATA_MODIFICATION',
    resource: 'diary_entry',
    resourceId: entry.id,
    success: true,
  });

  return decryptEntry(entry);
}

/**
 * Retorna a entrada do dia do paciente (apenas seus próprios dados)
 */
export async function getTodayEntry(patientId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entry = await prisma.diaryEntry.findUnique({
    where: { patientId_entryDate: { patientId, entryDate: today } },
  });

  if (!entry) return null;
  return decryptEntry(entry);
}

/**
 * Retorna entradas do diário de um paciente para o admin (nutricionista)
 * Marca como lido ao acessar.
 */
export async function getPatientDiaryForAdmin(
  patientId: string,
  nutritionistId: string,
  limit = 30,
) {
  // Verificar que o paciente pertence ao nutricionista
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, nutritionistId },
  });
  if (!patient) throw new AppError('Paciente não encontrado.', 404);

  const entries = await prisma.diaryEntry.findMany({
    where: { patientId },
    orderBy: { entryDate: 'desc' },
    take: limit,
  });

  // Marcar não lidos como lidos
  const unreadIds = entries.filter((e) => !e.isReadByAdmin).map((e) => e.id);
  if (unreadIds.length > 0) {
    await prisma.diaryEntry.updateMany({
      where: { id: { in: unreadIds } },
      data: { isReadByAdmin: true, readAt: new Date() },
    });
  }

  return entries.map(decryptEntry);
}

/**
 * Conta entradas não lidas pelo admin (para badge de notificação)
 */
export async function countUnreadDiaries(nutritionistId: string) {
  return prisma.diaryEntry.count({
    where: {
      isReadByAdmin: false,
      patient: { nutritionistId },
    },
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function decryptEntry(entry: any) {
  return {
    id: entry.id,
    patientId: entry.patientId,
    entryDate: entry.entryDate,
    text: decrypt(entry.textEncrypted),
    moodEmoji: entry.moodEmoji,
    checkedFoodIds: entry.checkedFoodIds,
    waterConsumedMl: entry.waterConsumedMl,
    isReadByAdmin: entry.isReadByAdmin,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
