// Simple in-memory store for email verification codes

interface VerificationEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

// In-memory cache
const cache = new Map<string, VerificationEntry>();

export async function setVerificationCode(token: string, code: string, email: string) {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  cache.set(token, {
    code,
    email,
    expiresAt,
    attempts: 0,
  });
}

export async function verifyCode(token: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const entry = cache.get(token);

  if (!entry) {
    return { valid: false, error: 'No verification code found. Please request a new code.' };
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(token);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (entry.attempts >= 5) {
    cache.delete(token);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  entry.attempts += 1;

  if (entry.code !== code) {
    return { valid: false, error: 'Invalid verification code.' };
  }

  // Code is valid - clear it
  cache.delete(token);

  return { valid: true };
}

export function getVerificationEmail(token: string): string | null {
  const entry = cache.get(token);
  return entry?.email ?? null;
}
