import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { Env } from '../config/env.js'
import type { Role } from '../shared/schemas.js'

export interface AccessClaims {
  sub: string // user id
  role: Role
  sid: string // session id
}

export interface AuthUser {
  id: string
  name: string
  email: string | null
  mobile: string | null
  role: Role
  sessionId: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessClaims
    user: AccessClaims
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthUser | null
  }
  interface FastifyInstance {
    /** preHandler: any logged-in, active user (students included). */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    /** preHandler: logged-in user with at least this role. */
    requireRole: (min: Role) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    /** Write an AuditLog row for the current request's user. */
    audit: (req: FastifyRequest, entry: { action: string; entityType: string; entityId?: string | null; diff?: unknown }) => Promise<void>
  }
}

/** STUDENT < SUPPORT < EDITOR < ADMIN < SUPER_ADMIN */
export const roleRank: Record<Role, number> = { STUDENT: 0, SUPPORT: 1, EDITOR: 2, ADMIN: 3, SUPER_ADMIN: 4 }
export const hasRole = (role: Role, min: Role) => roleRank[role] >= roleRank[min]

export const REFRESH_COOKIE = 'ec_refresh'

/**
 * Access token: short-lived JWT sent as `Authorization: Bearer <token>` (kept in memory by the frontend).
 * Refresh token: httpOnly cookie, rotated on every use (see modules/auth).
 * Every authenticated request re-reads the user, so a deactivated account or a role change applies immediately.
 */
export default fp<{ env: Env }>(
  async (app, { env }) => {
    await app.register(cookie)
    await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: `${env.ACCESS_TOKEN_MINUTES}m` } })

    app.decorateRequest('auth', null)

    const load = async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.auth) return req.auth
      let claims: AccessClaims
      try {
        claims = await req.jwtVerify<AccessClaims>()
      } catch {
        reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Please log in.' })
        return null
      }
      const [user, session] = await Promise.all([
        app.db.user.findUnique({ where: { id: claims.sub }, select: { id: true, name: true, email: true, mobile: true, role: true, isActive: true } }),
        app.db.session.findUnique({ where: { id: claims.sid }, select: { revokedAt: true, expiresAt: true } }),
      ])
      if (!user || !user.isActive || !session || session.revokedAt || session.expiresAt < new Date()) {
        reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Your session has ended. Please log in again.' })
        return null
      }
      req.auth = { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, sessionId: claims.sid }
      return req.auth
    }

    app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
      await load(req, reply)
    })

    app.decorate('requireRole', (min: Role) => async (req: FastifyRequest, reply: FastifyReply) => {
      const user = await load(req, reply)
      if (!user) return
      if (!hasRole(user.role, min)) {
        reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'You do not have permission to do this.' })
      }
    })

    app.decorate('audit', async (req: FastifyRequest, entry: { action: string; entityType: string; entityId?: string | null; diff?: unknown }) => {
      await app.db.auditLog.create({
        data: {
          actorId: req.auth?.id ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          diff: entry.diff === undefined ? undefined : JSON.parse(JSON.stringify(entry.diff)),
          ip: req.ip,
        },
      })
    })
  },
  { name: 'auth', dependencies: ['prisma'] },
)
