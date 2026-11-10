import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { InputError } from '../modules/admin/crud.js'

/**
 * One error shape for the whole API: { statusCode, error, message, issues? }.
 *  - Zod validation errors -> 400 with field-level issues (admin forms show them next to the field)
 *  - Prisma unique violation -> 409, missing row -> 404, FK restriction -> 409
 *  - anything else keeps its status; 5xx details are logged, never sent
 */
export default fp(
  async (app) => {
    app.setErrorHandler((err, req, reply) => {
      if (err instanceof ZodError) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid input',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        })
      }
      if (err instanceof InputError) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid input', issues: err.issues })
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          const target = (err.meta?.target as string[] | string | undefined) ?? 'value'
          return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: `Already exists: ${[target].flat().join(', ')}` })
        }
        if (err.code === 'P2025') return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' })
        if (err.code === 'P2003' || err.code === 'P2014') {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'This item is still used elsewhere (for example by orders). Archive it instead of deleting.',
          })
        }
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500
      if (status >= 500) {
        req.log.error({ err }, 'request failed')
        return reply.code(status).send({ statusCode: status, error: 'Internal Server Error', message: 'Something went wrong' })
      }
      return reply.code(status).send({ statusCode: status, error: (err as Error).name, message: (err as Error).message })
    })

    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found' }))
  },
  { name: 'errors' },
)
