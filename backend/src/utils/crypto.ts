// backend/src/utils/crypto.ts
// Criptografia AES-256-GCM para dados sensíveis de saúde (LGPD Art. 5° II)
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

if (KEY.length !== 32 && process.env.NODE_ENV === 'production') {
  throw new Error('ENCRYPTION_KEY inválida. Deve ter 32 bytes (64 hex chars).');
}

/**
 * Criptografa dado sensível com AES-256-GCM.
 * Retorna: iv:authTag:ciphertext (tudo em hex)
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Descriptografa dado armazenado com AES-256-GCM.
 * Lança exceção se o dado foi adulterado (autenticidade garantida via GCM).
 */
export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Formato de ciphertext inválido.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Hash seguro para comparação (ex: busca por e-mail sem descriptografar)
 */
export function deterministicHash(value: string): string {
  return crypto
    .createHmac('sha256', KEY)
    .update(value.toLowerCase().trim())
    .digest('hex');
}
