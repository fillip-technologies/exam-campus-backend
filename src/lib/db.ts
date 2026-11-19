import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * Prisma 7 talks to MySQL / MariaDB through a driver adapter (the `mariadb` driver speaks both).
 * One client per process; Fastify closes it on shutdown (see plugins/prisma.ts).
 */
export function createPrisma(databaseUrl: string) {
  const adapter = new PrismaMariaDb(withPoolDefaults(databaseUrl))
  return new PrismaClient({
    adapter,
    // Interactive transactions (admin saves, reorder, seed) run many statements; with a hosted database every
    // statement is a network round trip (~150 ms), so Prisma's 5 s default is too short.
    transactionOptions: { maxWait: 10_000, timeout: 60_000 },
  })
}

/**
 * The mariadb driver defaults to a pool of 10 connections, all opened eagerly (minimumIdle = connectionLimit)
 * and re-opened whenever the server drops them. Shared MySQL hosts cap new connections per hour
 * (e.g. max_connections_per_hour = 500), so every restart and every server-side idle kill burns ~10 of that
 * quota. Keep the pool small and lazy. Any value already present in DATABASE_URL's query string wins.
 */
const POOL_DEFAULTS: Record<string, string> = {
  connectionLimit: process.env.DB_POOL_LIMIT ?? '3',
  minimumIdle: process.env.DB_POOL_MIN_IDLE ?? '1',
  // Seconds an extra (above minimumIdle) connection may sit idle before it is closed.
  idleTimeout: process.env.DB_POOL_IDLE_TIMEOUT ?? '300',
  acquireTimeout: '20000',
}

function withPoolDefaults(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  for (const [key, value] of Object.entries(POOL_DEFAULTS)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  return url.toString()
}

export type Db =ReturnType<typeof createPrisma>
