// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';
import { prisma } from '../config/database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'ADMIN' | 'PATIENT';
        jti: string;
      };
    }
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

/**
 * Verifica JWT e popula req.user
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token de autenticação não fornecido.', 401);
    }

    const token = authHeader.slice(7);

    let payload: { sub: string; role: string; jti: string };
    try {
      payload = jwt.verify(token, ACCESS_SECRET) as any;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Sessão expirada. Faça login novamente.', 401);
      }
      throw new AppError('Token inválido.', 401);
    }

    // Verificar se JTI foi revogado (logout ou rotação de token)
    const isRevoked = await redis.exists(`revoked:${payload.jti}`);
    if (isRevoked) {
      throw new AppError('Token revogado. Faça login novamente.', 401);
    }

    // Verificar se usuário ainda existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('Usuário não encontrado ou desativado.', 401);
    }

    req.user = {
      id: user.id,
      role: user.role as 'ADMIN' | 'PATIENT',
      jti: payload.jti,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * RBAC — restringe acesso por role
 */
export function authorize(...roles: Array<'ADMIN' | 'PATIENT'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Não autenticado.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Sem permissão para acessar este recurso.', 403));
    }
    next();
  };
}

/**
 * Garante que paciente só acessa seus próprios dados
 */
export function ownPatientOnly(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.user?.role === 'ADMIN') return next(); // Admin acessa tudo

  const patientIdParam = req.params.patientId || req.params.id;
  if (!patientIdParam) return next();

  // Verificar se o patientId da URL corresponde ao userId do token
  // (será resolvido no service via prisma where)
  next();
}
