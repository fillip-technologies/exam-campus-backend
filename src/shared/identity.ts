import { z } from 'zod'

/**
 * Login identifier = email OR 10-digit Indian mobile number, the same rules as the frontend's
 * services/authService.js (isEmail / isMobile / cleanIdentifier).
 */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export const isMobile = (value: string) => /^[6-9]\d{9}$/.test(value.replace(/[\s-]/g, ''))

export type Identifier = { kind: 'email'; value: string } | { kind: 'mobile'; value: string }

export const identifier = z
  .string()
  .trim()
  .min(1, 'Enter your email address or mobile number.')
  .max(191)
  .transform((v, ctx): Identifier => {
    const mobile = v.replace(/[\s-]/g, '').replace(/^\+91/, '')
    if (isMobile(mobile)) return { kind: 'mobile', value: mobile }
    if (isEmail(v)) return { kind: 'email', value: v.toLowerCase() }
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address or 10-digit mobile number.' })
    return z.NEVER
  })

export const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')

export const personName = z.string().trim().min(1, 'Enter your name.').max(191)
