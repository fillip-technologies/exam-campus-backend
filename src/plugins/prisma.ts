import fp from 'fastify-plugin'
import { createPrisma, type Db } from '../lib/db.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

/** Decorates the app with `app.db` (Prisma client) and disconnects it when the server closes. */
export default fp<{ databaseUrl: string; db?: Db }>(
  async (app, opts) => {
    const db = opts.db ?? createPrisma(opts.databaseUrl)
    app.decorate('db', db)
    app.addHook('onClose', async () => {
      await db.$disconnect()
    })
  },
  { name: 'prisma' },
)
