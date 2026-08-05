// In-memory store for email verification codes
// In production, consider using a database table

interface VerificationEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, VerificationEntry>();

export function setVerificationCode(token: string, code: string, email: string) {
  // Clean expired entries
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if ((entry?.expiresAt ?? 0) < now) {
      store.delete(key);
    }
  }

  store.set(token, {
    code,
    email,
    expiresAt: now + 15 * 60 * 1000, // 15 minutes
    attempts: 0,
  });
}

export function verifyCode(token: string, code: string): { valid: boolean; error?: string } {
  const entry = store.get(token);
  if (!entry) {
    return { valid: false, error: 'No verification code found. Please request a new code.' };
  }

  if ((entry?.expiresAt ?? 0) < Date.now()) {
    store.delete(token);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if ((entry?.attempts ?? 0) >= 5) {
    store.delete(token);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  entry.attempts = (entry?.attempts ?? 0) + 1;

  if (entry?.code !== code) {
    return { valid: false, error: 'Invalid verification code.' };
  }

  // Code is valid - mark as used
  store.delete(token);
  return { valid: true };
}

export function getVerificationEmail(token: string): string | null {
  const entry = store.get(token);
  return entry?.email ?? null;
}
