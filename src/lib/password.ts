import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

const options = { type: argon2.argon2id } as const

export const hashPassword = (password: string) => argon2.hash(password, options)

// Verified when the account does not exist, so "no such user" and "wrong password" take the same time.
let dummyHash: Promise<string> | null = null

export async function verifyPassword(hash: string | null | undefined, password: string) {
  if (!hash) {
    dummyHash ??= argon2.hash('not-a-real-password', options)
    await argon2.verify(await dummyHash, password).catch(() => false)
    return false
  }
  return argon2.verify(hash, password).catch(() => false)
}

/** Opaque random token (refresh tokens). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

/** sha256 for refresh tokens and OTP codes (high-entropy or short-lived, so a fast hash is fine). */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** 6-digit OTP */
export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')
