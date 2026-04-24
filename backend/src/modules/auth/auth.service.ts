// backend/src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { auditLog } from '../../utils/audit';
import type { LoginInput, RegisterInput } from './auth.schema';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

interface TokenPayload {
  sub: string;    // userId
  role: string;
  jti: string;    // JWT ID para revogação
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

export async function login(
  input: LoginInput,
  ipAddress: string,
  userAgent: string,
) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
    include: {
      nutritionist: { select: { id: true, name: true, crnNumber: true } },
      patient: { select: { id: true, name: true } },
    },
  });

  // Timing-safe: sempre verifica hash mesmo se usuário não existe
  const dummyHash = '$2b$12$invalidhashfortimingreasons000000000000000000000000000';
  const passwordToCheck = user?.passwordHash ?? dummyHash;
  const isValid = await bcrypt.compare(input.password, passwordToCheck);

  if (!user || !isValid) {
    if (user) {
      await handleFailedLogin(user.id);
    }
    await auditLog({
      action: 'LOGIN',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: 'Credenciais inválidas',
      metadata: { email: input.email },
    });
    throw new AppError('E-mail ou senha incorretos.', 401);
  }

  if (!user.isActive || user.deletedAt) {
    throw new AppError('Conta desativada. Entre em contato com o suporte.', 403);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(`Conta bloqueada. Tente novamente em ${minutes} minuto(s).`, 429);
  }

  // Reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  const tokens = await generateTokenPair(user.id, user.role, ipAddress, userAgent);

  await auditLog({
    userId: user.id,
    action: 'LOGIN',
    ipAddress,
    userAgent,
    success: true,
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.role === 'ADMIN' ? user.nutritionist : user.patient,
    },
  };
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string, ipAddress: string) {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Refresh token inválido ou expirado.', 401);
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    // Possível reutilização de token — revogar todos os tokens do usuário
    if (storedToken) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { revokedAt: new Date() },
      });
      logger.warn(`Refresh token reuse detected for user ${storedToken.userId} from ${ipAddress}`);
    }
    throw new AppError('Token de sessão inválido. Faça login novamente.', 401);
  }

  // Revogar token atual (rotação)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  const user = storedToken.user;
  const newTokens = await generateTokenPair(user.id, user.role, ipAddress, '');

  return { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken };
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export async function logout(userId: string, refreshToken?: string, ipAddress?: string) {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId },
      data: { revokedAt: new Date() },
    });
  }

  await auditLog({ userId, action: 'LOGOUT', ipAddress, success: true });
}

// ─── REGISTER (apenas admin pode criar pacientes) ────────────────────────────

export async function registerPatient(
  input: RegisterInput,
  nutritionistId: string,
  ipAddress: string,
) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) {
    throw new AppError('E-mail já cadastrado.', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      role: 'PATIENT',
      consents: {
        create: {
          consentType: 'data_processing',
          status: 'GRANTED',
          grantedAt: new Date(),
          ipAddress,
          version: '1.0',
        },
      },
    },
  });

  logger.info(`Patient user created: ${user.id} by nutritionist ${nutritionistId}`);
  return user;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function generateTokenPair(
  userId: string,
  role: string,
  ipAddress: string,
  userAgent: string,
) {
  const jti = uuidv4();

  const accessToken = jwt.sign(
    { sub: userId, role, jti } as TokenPayload,
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY as any },
  );

  const refreshToken = jwt.sign(
    { sub: userId, role, jti: uuidv4() } as TokenPayload,
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY as any },
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
      ipAddress,
      deviceInfo: userAgent,
    },
  });

  // Blacklist do JTI no Redis para revogação imediata
  await redis.setex(`jti:${jti}`, 15 * 60, '1'); // 15 minutos

  return { accessToken, refreshToken };
}

async function handleFailedLogin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const newCount = user.failedLoginCount + 1;
  const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: newCount,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : undefined,
    },
  });

  if (shouldLock) {
    logger.warn(`Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts: ${userId}`);
  }
}
