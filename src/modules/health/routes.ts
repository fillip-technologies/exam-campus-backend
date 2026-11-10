import type { FastifyPluginAsync } from 'fastify'

/**
 * GET /health        liveness: the process is up (no DB call; for load balancers).
 * GET /api/v1/health readiness: also checks the database round trip.
 */
export const livenessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }))
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const started = performance.now()
    try {
      await app.db.$queryRaw`SELECT 1`
      return { status: 'ok', db: 'ok', dbLatencyMs: Math.round(performance.now() - started) }
    } catch (err) {
      app.log.error({ err }, 'database health check failed')
      return reply.code(503).send({ status: 'error', db: 'unreachable' })
    }
  })
}
