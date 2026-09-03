import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * Symmetric encryption for third-party secrets we must store and later replay
 * (a school's Razorpay key secret and webhook secret). Passwords are hashed,
 * never encrypted — this is only for values we genuinely have to read back.
 *
 * AES-256-GCM: the auth tag makes tampering detectable, so a mangled row fails
 * loudly instead of decrypting to garbage. Format is `v1:iv:tag:ciphertext`,
 * base64url per part, version-prefixed so the scheme can change later.
 */
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * The 32-byte key, derived from `ENCRYPTION_KEY`. Read lazily so importing
 * this module doesn't crash a process that never encrypts anything (the
 * seeders, for instance).
 */
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY is missing or too short — set a random 32+ character value in .env',
    );
  }
  // SHA-256 widens any passphrase to exactly the 32 bytes AES-256 needs.
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored secret is not in the expected format');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Constant-time comparison of two hex signatures. A plain `===` leaks how much
 * of a forged signature was correct through timing, which is enough to forge
 * one byte at a time.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Shows a secret as `rzp_…4f2a` for confirmation without revealing it. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
