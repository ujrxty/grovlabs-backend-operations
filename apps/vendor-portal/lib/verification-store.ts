// Database-backed store for email verification codes
// Uses a simple in-memory cache with database fallback

import { prisma } from './db'

interface VerificationEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

// In-memory cache (fast lookups, but may clear on hot reload)
const cache = new Map<string, VerificationEntry>();

export async function setVerificationCode(token: string, code: string, email: string) {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  // Store in memory cache
  cache.set(token, {
    code,
    email,
    expiresAt,
    attempts: 0,
  });

  // Also store in database for persistence
  try {
    await prisma.insertion_order.update({
      where: { sign_token: token },
      data: {
        verification_code: code,
        verification_email: email.toLowerCase(),
        verification_expires: new Date(expiresAt),
        verification_attempts: 0,
      },
    });
  } catch (e) {
    // IO might not exist or field might not exist - that's ok, use memory only
    console.log('DB verification store fallback to memory-only');
  }
}

export async function verifyCode(token: string, code: string): Promise<{ valid: boolean; error?: string; io?: any }> {
  // Try memory cache first
  let entry = cache.get(token);

  // If not in cache, try database
  if (!entry) {
    try {
      const io = await prisma.insertion_order.findUnique({
        where: { sign_token: token },
        select: {
          id: true,
          io_number: true,
          status: true,
          verification_code: true,
          verification_email: true,
          verification_expires: true,
          verification_attempts: true,
          vendor: { select: { company_name: true } },
          campaign: { select: { name: true } },
        },
      });

      if (io?.verification_code && io?.verification_expires) {
        entry = {
          code: io.verification_code,
          email: io.verification_email || '',
          expiresAt: new Date(io.verification_expires).getTime(),
          attempts: io.verification_attempts || 0,
        };
        // Restore to cache
        cache.set(token, entry);
      }
    } catch (e) {
      // DB lookup failed, entry stays null
    }
  }

  if (!entry) {
    return { valid: false, error: 'No verification code found. Please request a new code.' };
  }

  if ((entry?.expiresAt ?? 0) < Date.now()) {
    cache.delete(token);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if ((entry?.attempts ?? 0) >= 5) {
    cache.delete(token);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  entry.attempts = (entry?.attempts ?? 0) + 1;

  // Update attempts in DB
  try {
    await prisma.insertion_order.update({
      where: { sign_token: token },
      data: { verification_attempts: entry.attempts },
    });
  } catch (e) {}

  if (entry?.code !== code) {
    return { valid: false, error: 'Invalid verification code.' };
  }

  // Code is valid - clear it
  cache.delete(token);
  try {
    await prisma.insertion_order.update({
      where: { sign_token: token },
      data: { verification_code: null, verification_email: null, verification_expires: null },
    });
  } catch (e) {}

  // Fetch IO data for the response
  const io = await prisma.insertion_order.findUnique({
    where: { sign_token: token },
    include: {
      vendor: { select: { company_name: true, email: true } },
      campaign: { select: { name: true, payout: true, payout_type: true } },
    },
  });

  return { valid: true, io };
}

export function getVerificationEmail(token: string): string | null {
  const entry = cache.get(token);
  return entry?.email ?? null;
}

// Sync wrapper for backward compatibility
export function setVerificationCodeSync(token: string, code: string, email: string) {
  cache.set(token, {
    code,
    email,
    expiresAt: Date.now() + 15 * 60 * 1000,
    attempts: 0,
  });
  // Fire and forget DB update
  setVerificationCode(token, code, email).catch(() => {});
}
