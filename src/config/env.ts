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
    /** Explicit opt-in to print OTP codes to the server log in production (until an SMS / email provider exists). */
    ALLOW_OTP_LOG_IN_PRODUCTION: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // ---- files ----
    /**
     * Where NEW uploads are stored. "cloudinary" = Cloudinary (images + PDFs, served from its CDN);
     * "local" = UPLOAD_DIR on this server, served by the API at /uploads/*. Switching later is safe: older files
     * stay where they were uploaded and keep working.
     */
    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    /** cloudinary://<api_key>:<api_secret>@<cloud_name> (Cloudinary console → API Keys → "API environment variable") */
    CLOUDINARY_URL: z
      .string()
      .regex(/^cloudinary:\/\/[^:]+:[^@]+@[^/?#]+$/, 'CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>')
      .optional(),
    /** Folder in the Cloudinary media library that this site's uploads go into (one per environment, e.g. examcampus-staging). */
    CLOUDINARY_FOLDER: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]{0,60}$/, 'Lowercase letters, numbers, - and _')
      .default('examcampus'),
    UPLOAD_DIR: z.string().default('uploads'),
    /** Public base URL of files in UPLOAD_DIR (https://api.examcampus.in/uploads); default = http://localhost:PORT/uploads. */
    PUBLIC_UPLOAD_URL: z.string().optional(),
    MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === 'cloudinary' && !v.CLOUDINARY_URL)
      ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_URL'], message: 'STORAGE_DRIVER=cloudinary needs CLOUDINARY_URL' })
    if (v.NODE_ENV === 'production' && v.STORAGE_DRIVER === 'local' && !v.PUBLIC_UPLOAD_URL)
      ctx.addIssue({ code: 'custom', path: ['PUBLIC_UPLOAD_URL'], message: 'STORAGE_DRIVER=local in production needs PUBLIC_UPLOAD_URL (e.g. https://api.examcampus.in/uploads)' })
    if (v.NODE_ENV === 'production' && v.OTP_DELIVERY === 'log' && !v.ALLOW_OTP_LOG_IN_PRODUCTION)
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
