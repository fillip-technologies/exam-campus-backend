import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * Prisma 7 talks to MySQL / MariaDB through a driver adapter (the `mariadb` driver speaks both).
 * One client per process; Fastify closes it on shutdown (see plugins/prisma.ts).
 */
export function createPrisma(databaseUrl: string) {
  const adapter = new PrismaMariaDb(databaseUrl)
  return new PrismaClient({
    adapter,
    // Interactive transactions (admin saves, reorder, seed) run many statements; with a hosted database every
    // statement is a network round trip (~150 ms), so Prisma's 5 s default is too short.
    transactionOptions: { maxWait: 10_000, timeout: 60_000 },
  })
}

export type Db = ReturnType<typeof createPrisma>
