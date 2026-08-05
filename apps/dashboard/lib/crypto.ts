import crypto from 'crypto'

// AES-256-GCM encryption for sensitive payment details stored at rest.
// The key comes from the PAYMENT_VAULT_KEY env var (base64-encoded 32 bytes).

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.PAYMENT_VAULT_KEY
  if (!raw) {
    throw new Error('PAYMENT_VAULT_KEY is not configured')
  }
  // Accept base64 (preferred) or hex-encoded 32-byte keys.
  let key: Buffer
  try {
    key = Buffer.from(raw, 'base64')
    if (key.length !== 32) {
      key = Buffer.from(raw, 'hex')
    }
  } catch {
    key = Buffer.from(raw, 'hex')
  }
  if (key.length !== 32) {
    throw new Error('PAYMENT_VAULT_KEY must decode to exactly 32 bytes')
  }
  return key
}

/**
 * Encrypt a plaintext string. Returns a compact string of the form
 * `ivHex:authTagHex:cipherHex` that can be stored in a single column.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a string produced by encrypt(). Throws if the payload is malformed
 * or the auth tag does not verify (tampering / wrong key).
 */
export function decrypt(payload: string): string {
  const key = getKey()
  const parts = String(payload).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format')
  }
  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

/** Encrypt an arbitrary JSON-serializable object. */
export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj))
}

/** Decrypt back into an object. Returns null if parsing fails. */
export function decryptJson<T = any>(payload: string): T | null {
  try {
    return JSON.parse(decrypt(payload)) as T
  } catch {
    return null
  }
}
