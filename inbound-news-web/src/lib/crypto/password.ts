import { hash, verify } from "@node-rs/argon2"

const ARGON2ID_OPTIONS = {
  memoryCost: 65536,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
  algorithm: 2 as number,
} as const

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_OPTIONS)
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password)
  } catch {
    return false
  }
}

export function isArgon2idHash(h: string): boolean {
  return h.startsWith("$argon2id$")
}

export function isLegacyHash(h: string): boolean {
  return (
    h.startsWith("$2a$") ||
    h.startsWith("$2b$") ||
    h.startsWith("$2y$") ||
    h.startsWith("0:") ||
    h.startsWith("1:") ||
    /^[a-f0-9]{32}$/i.test(h) ||
    /^[a-f0-9]{40}$/i.test(h) ||
    /^[a-f0-9]{64}$/i.test(h)
  )
}
