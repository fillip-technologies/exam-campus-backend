import { z } from 'zod'

const list = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().regex(/^mysql:\/\//, 'DATABASE_URL must start with mysql://'),
    /** Comma-separated list of frontend origins allowed to call the API with cookies. */
    CORS_ORIGINS: list('http://localhost:5173'),

    // ---- auth ----
    /** Signs access tokens. At least 32 random characters; changing it logs everyone out of their access token. */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /** e.g. ".examcampus.in" when the API is api.examcampus.in; empty = host-only cookie */
    COOKIE_DOMAIN: z.string().optional(),
    /** How OTP codes are delivered. "log" prints them to the server log (development only). */
    OTP_DELIVERY: z.enum(['log']).default('log'),

    // ---- files ----
    /** Where uploads are stored. "local" = UPLOAD_DIR on this server, served at /uploads/* (S3/R2 later). */
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    /** Public base URL of uploaded files; default = this API's /uploads path. */
    PUBLIC_UPLOAD_URL: z.string().optional(),
    MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && v.OTP_DELIVERY === 'log')
      ctx.addIssue({ code: 'custom', path: ['OTP_DELIVERY'], message: 'Set a real OTP delivery provider before production' })
  })

export type Env = z.infer<typeof schema>

/** Reads and validates process.env once at startup; a bad value stops the server with a clear message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return parsed.data
}
