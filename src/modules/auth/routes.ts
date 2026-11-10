import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Env } from '../../config/env.js'
import { hashPassword, otpCode, randomToken, safeEqual, sha256, verifyPassword } from '../../lib/password.js'
import { REFRESH_COOKIE } from '../../plugins/auth.js'
import { identifier, password, personName, type Identifier } from '../../shared/identity.js'
import type { Role } from '../../shared/schemas.js'
import { deliverOtp } from './otp.js'

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_SECONDS = 60

type UserRow = { id: string; name: string; email: string | null; mobile: string | null; role: Role }

/** Same shape as the frontend's authService session ({ id, name, identifier }) plus contact fields and role. */
export const sessionUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  identifier: u.email ?? u.mobile,
  email: u.email,
  mobile: u.mobile,
  role: u.role,
})

const whereIdentifier = (id: Identifier) => (id.kind === 'email' ? { email: id.value } : { mobile: id.value })

const userSelect = { id: true, name: true, email: true, mobile: true, role: true, isActive: true, passwordHash: true } as const

/**
 * /api/v1/auth: accounts for everyone who uses the site. Students sign up here; admins are created with
 * `npm run admin:create` and log in through the same endpoints (their role unlocks /admin).
 *
 * Session = Session row + httpOnly refresh cookie "<sessionId>.<secret>" (only the secret's sha256 is stored).
 * Each refresh replaces the secret, so a copied old cookie stops working. The frontend keeps the access token
 * in memory and should run one refresh at a time across tabs (e.g. navigator.locks).
 */
export const authRoutes: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  const secure = env.NODE_ENV === 'production'
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  }

  /** Cookie endpoints only accept browser requests from the allowed frontend origins (CSRF defence with SameSite). */
  const allowedOrigin = async (req: FastifyRequest, reply: FastifyReply) => {
    const origin = req.headers.origin
    if (origin && !env.CORS_ORIGINS.includes(origin)) {
      reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Origin not allowed' })
    }
  }

  async function startSession(req: FastifyRequest, reply: FastifyReply, user: UserRow) {
    const secret = randomToken()
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000)
    const session = await app.db.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(secret),
        userAgent: req.headers['user-agent']?.slice(0, 512) ?? null,
        ip: req.ip,
        expiresAt,
      },
    })
    await app.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    reply.setCookie(REFRESH_COOKIE, `${session.id}.${secret}`, { ...cookieOptions, expires: expiresAt })
    return { accessToken: await reply.jwtSign({ sub: user.id, role: user.role, sid: session.id }), user: sessionUser(user) }
  }

  const unauthorized = (reply: FastifyReply, message: string) => reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message })

  // ---- password signup / login ------------------------------------------

  app.post('/signup', { preHandler: allowedOrigin, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ name: personName, identifier, password }).parse(req.body)
    const exists = await app.db.user.findFirst({ where: whereIdentifier(body.identifier), select: { id: true } })
    if (exists) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'An account with this email or mobile number already exists. Please log in.' })
    }
    const user = await app.db.user.create({
      data: { name: body.name, ...whereIdentifier(body.identifier), passwordHash: await hashPassword(body.password), role: 'STUDENT' },
    })
    return reply.code(201).send(await startSession(req, reply, user))
  })

  app.post('/login', { preHandler: allowedOrigin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ identifier, password: z.string().min(1).max(128) }).parse(req.body)
    const user = await app.db.user.findFirst({ where: whereIdentifier(body.identifier), select: userSelect })
    const ok = await verifyPassword(user?.passwordHash, body.password)
    if (!user || !ok) return unauthorized(reply, 'Incorrect email / mobile number or password.')
    if (!user.isActive) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'This account is disabled. Please contact support.' })
    return startSession(req, reply, user)
  })

  // ---- refresh / logout ---------------------------------------------------

  const readCookie = (req: FastifyRequest) => {
    const raw = req.cookies[REFRESH_COOKIE]
    const [id, secret] = raw?.split('.') ?? []
    return id && secret ? { id, secret } : null
  }

  app.post('/refresh', { preHandler: allowedOrigin, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const token = readCookie(req)
    if (!token) return unauthorized(reply, 'Please log in.')
    const session = await app.db.session.findUnique({
      where: { id: token.id },
      include: { user: { select: { id: true, name: true, email: true, mobile: true, role: true, isActive: true } } },
    })
    const valid =
      session && !session.revokedAt && session.expiresAt > new Date() && session.user.isActive && safeEqual(session.refreshTokenHash, sha256(token.secret))
    if (!session || !valid) {
      if (session && !safeEqual(session.refreshTokenHash, sha256(token.secret))) req.log.warn({ sessionId: session.id }, 'stale refresh token presented')
      reply.clearCookie(REFRESH_COOKIE, cookieOptions)
      return unauthorized(reply, 'Your session has ended. Please log in again.')
    }
    const secret = randomToken()
    await app.db.session.update({ where: { id: session.id }, data: { refreshTokenHash: sha256(secret) } })
    reply.setCookie(REFRESH_COOKIE, `${session.id}.${secret}`, { ...cookieOptions, expires: session.expiresAt })
    return {
      accessToken: await reply.jwtSign({ sub: session.user.id, role: session.user.role, sid: session.id }),
      user: sessionUser(session.user),
    }
  })

  app.post('/logout', { preHandler: allowedOrigin }, async (req, reply) => {
    const token = readCookie(req)
    if (token) await app.db.session.updateMany({ where: { id: token.id, revokedAt: null }, data: { revokedAt: new Date() } })
    reply.clearCookie(REFRESH_COOKIE, cookieOptions)
    return reply.code(204).send()
  })

  app.post('/logout-all', { preHandler: [allowedOrigin, app.authenticate] }, async (req, reply) => {
    await app.db.session.updateMany({ where: { userId: req.auth!.id, revokedAt: null }, data: { revokedAt: new Date() } })
    reply.clearCookie(REFRESH_COOKIE, cookieOptions)
    return reply.code(204).send()
  })

  // ---- OTP: passwordless login and password reset ------------------------

  const otpPurpose = z.enum(['LOGIN', 'RESET_PASSWORD'])

  app.post('/otp/request', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ identifier, purpose: otpPurpose }).parse(req.body)
    const answer = { ok: true, expiresInSeconds: OTP_TTL_MINUTES * 60 }
    // Same answer whether or not an account exists, so the endpoint cannot be used to find accounts.
    const user = await app.db.user.findFirst({ where: { ...whereIdentifier(body.identifier), isActive: true }, select: { id: true } })
    if (!user) return reply.code(202).send(answer)

    const recent = await app.db.otpCode.findFirst({
      where: { identifier: body.identifier.value, purpose: body.purpose, createdAt: { gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) } },
    })
    if (recent) return reply.code(429).send({ statusCode: 429, error: 'Too Many Requests', message: 'Please wait a minute before asking for another code.' })

    const code = otpCode()
    await app.db.otpCode.create({
      data: {
        identifier: body.identifier.value,
        purpose: body.purpose,
        codeHash: sha256(`${body.identifier.value}:${code}`),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    })
    await deliverOtp(app, env, { to: body.identifier, code, purpose: body.purpose })
    return reply.code(202).send(answer)
  })

  /** Checks the newest unused code; wrong guesses count against it and it dies after OTP_MAX_ATTEMPTS. */
  async function consumeOtp(id: Identifier, purpose: 'LOGIN' | 'RESET_PASSWORD', code: string) {
    const otp = await app.db.otpCode.findFirst({
      where: { identifier: id.value, purpose, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS } },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) return false
    if (!safeEqual(otp.codeHash, sha256(`${id.value}:${code}`))) {
      await app.db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      return false
    }
    const used = await app.db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } })
    return used.count === 1
  }

  const otpBody = { identifier, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') }
  const verifiedField = (id: Identifier) => (id.kind === 'email' ? { emailVerifiedAt: new Date() } : { mobileVerifiedAt: new Date() })

  app.post('/otp/verify', { preHandler: allowedOrigin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object(otpBody).parse(req.body)
    if (!(await consumeOtp(body.identifier, 'LOGIN', body.code))) return unauthorized(reply, 'The code is wrong or has expired.')
    const user = await app.db.user.findFirst({ where: { ...whereIdentifier(body.identifier), isActive: true }, select: userSelect })
    if (!user) return unauthorized(reply, 'The code is wrong or has expired.')
    await app.db.user.update({ where: { id: user.id }, data: verifiedField(body.identifier) })
    return startSession(req, reply, user)
  })

  app.post('/password/reset', { preHandler: allowedOrigin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ ...otpBody, newPassword: password }).parse(req.body)
    if (!(await consumeOtp(body.identifier, 'RESET_PASSWORD', body.code))) return unauthorized(reply, 'The code is wrong or has expired.')
    const user = await app.db.user.findFirst({ where: { ...whereIdentifier(body.identifier), isActive: true }, select: userSelect })
    if (!user) return unauthorized(reply, 'The code is wrong or has expired.')
    await app.db.$transaction([
      app.db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword), ...verifiedField(body.identifier) } }),
      // a reset logs out every device
      app.db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ])
    return startSession(req, reply, user)
  })
}

/** /api/v1/me: the logged-in user's own account. */
export const meRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (req) => sessionUser(req.auth!))

  app.patch('/', async (req) => {
    const body = z.object({ name: personName }).parse(req.body)
    const user = await app.db.user.update({ where: { id: req.auth!.id }, data: { name: body.name } })
    return sessionUser(user)
  })

  app.post('/password', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ currentPassword: z.string().max(128).optional(), newPassword: password }).parse(req.body)
    const user = await app.db.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { passwordHash: true } })
    // OTP-only accounts have no password yet and may set one without the current password
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, body.currentPassword ?? ''))) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid input',
        issues: [{ path: 'currentPassword', message: 'Your current password is incorrect.' }],
      })
    }
    await app.db.$transaction([
      app.db.user.update({ where: { id: req.auth!.id }, data: { passwordHash: await hashPassword(body.newPassword) } }),
      // keep this device, log out the others
      app.db.session.updateMany({ where: { userId: req.auth!.id, revokedAt: null, id: { not: req.auth!.sessionId } }, data: { revokedAt: new Date() } }),
    ])
    return reply.code(204).send()
  })

  app.get('/sessions', async (req) => {
    const sessions = await app.db.session.findMany({
      where: { userId: req.auth!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
    })
    return { items: sessions.map((s) => ({ ...s, current: s.id === req.auth!.sessionId })) }
  })
}
