import path from 'node:path'
import { mkdirSync } from 'node:fs'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import etag from '@fastify/etag'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import type { Env } from './config/env.js'
import { createMemoryCache, type Cache } from './lib/cache.js'
import type { Db } from './lib/db.js'
import authPlugin from './plugins/auth.js'
import errorsPlugin from './plugins/errors.js'
import prismaPlugin from './plugins/prisma.js'
import { adminRoutes } from './modules/admin/routes.js'
import { authRoutes, meRoutes } from './modules/auth/routes.js'
import { healthRoutes, livenessRoutes } from './modules/health/routes.js'
import { publicRoutes } from './modules/public/routes.js'

declare module 'fastify' {
  interface FastifyInstance {
    cache: Cache
  }
}

export interface BuildAppOptions {
  env: Env
  /** Inject a client in tests; otherwise one is created from env.DATABASE_URL. */
  db?: Db
}

/** Builds the Fastify app without listening, so tests can call app.inject(). */
export async function buildApp({ env, db }: BuildAppOptions) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: env.LOG_LEVEL, transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : { level: env.LOG_LEVEL },
    trustProxy: true, // behind the host's load balancer: real client IP for rate limits and audit logs
  })

  await app.register(errorsPlugin)
  // cross-origin resource policy: the frontend (another origin) must be able to show images from /uploads
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } })
  // The frontend is hosted on its own domain, so the API allows only the listed origins (with cookies for auth).
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
  await app.register(sensible)
  await app.register(etag) // weak ETag on every response: unchanged content answers 304
  // Opt-in per route (config.rateLimit). In-memory store; switch to Redis when running more than one instance.
  await app.register(rateLimit, { global: false })
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL, ...(db ? { db } : {}) })
  app.decorate('cache', createMemoryCache())
  await app.register(authPlugin, { env })

  // Uploaded files (local storage driver). Keys are random and never reused, so they can be cached forever.
  if (env.STORAGE_DRIVER === 'local') {
    const root = path.resolve(env.UPLOAD_DIR)
    mkdirSync(root, { recursive: true })
    await app.register(fastifyStatic, {
      root,
      prefix: '/uploads/',
      index: false,
      list: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.header('cache-control', 'public, max-age=31536000, immutable')
        res.header('x-content-type-options', 'nosniff')
        // a file opened directly can never run scripts (PDFs and images only, but defence in depth)
        res.header('content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
      },
    })
  }

  await app.register(livenessRoutes)
  await app.register(
    async (v1) => {
      await v1.register(healthRoutes)
      await v1.register(publicRoutes, { prefix: '/public' })
      await v1.register(authRoutes, { prefix: '/auth', env })
      await v1.register(meRoutes, { prefix: '/me' })
      await v1.register(adminRoutes, { prefix: '/admin', env })
    },
    { prefix: '/api/v1' },
  )

  return app
}
