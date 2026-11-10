import { Readable } from 'node:stream'
import multipart from '@fastify/multipart'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Env } from '../../config/env.js'
import { hashPassword } from '../../lib/password.js'
import { createStorage, imageSize, newKey, sniffType } from '../../lib/storage.js'
import { hasRole, roleRank } from '../../plugins/auth.js'
import { identifier, password, personName } from '../../shared/identity.js'
import { role as roleSchema, type Role } from '../../shared/schemas.js'
import { sessionUser } from '../auth/routes.js'
import { registerResource, restorable, type Resource } from './crud.js'
import { f, linkFields, checkLink } from './fields.js'
import { resources } from './resources.js'

/**
 * /api/v1/admin/*: staff only (SUPPORT and above; each route sets its own minimum role).
 * Any successful write clears the public response cache.
 */
export const adminRoutes: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  app.addHook('preHandler', app.requireRole('SUPPORT'))
  app.addHook('onResponse', async (req, reply) => {
    if (req.method !== 'GET' && reply.statusCode < 400) app.cache.invalidate()
  })

  const registry = new Map<string, Resource>()
  for (const r of resources) registerResource(app, r, registry)

  // ---- dashboard ------------------------------------------------------------
  app.get('/dashboard', async () => {
    const since = new Date(Date.now() - 7 * 86_400_000)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const [students, newStudents, waitlist, newMessages, latestMessages, examsByStatus, ordersToday, revenueToday] = await Promise.all([
      app.db.user.count({ where: { role: 'STUDENT' } }),
      app.db.user.count({ where: { role: 'STUDENT', createdAt: { gte: since } } }),
      app.db.waitlistEntry.count(),
      app.db.contactMessage.count({ where: { status: 'NEW' } }),
      app.db.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      app.db.exam.groupBy({ by: ['status'], _count: { _all: true } }),
      app.db.order.count({ where: { status: 'PAID', paidAt: { gte: startOfDay } } }),
      app.db.order.aggregate({ where: { status: 'PAID', paidAt: { gte: startOfDay } }, _sum: { amountPaise: true } }),
    ])
    return {
      students,
      newStudents7d: newStudents,
      waitlist,
      newMessages,
      latestMessages,
      examsByStatus: Object.fromEntries(examsByStatus.map((g) => [g.status, g._count._all])),
      ordersToday,
      revenueTodayPaise: revenueToday._sum.amountPaise ?? 0,
    }
  })

  // ---- site settings (single row, ADMIN) -----------------------------------
  const siteFields = z.object({
    siteName: f.str(),
    tagline: f.optStr(),
    logoMarkUrl: f.optUrl(),
    logoWordmarkUrl: f.optUrl(),
    faviconUrl: f.optUrl(),
    headerLoginLabel: f.str(),
    headerCtaLabel: f.str(),
    ...linkFields('headerCta'),
    searchPlaceholder: f.optStr(500),
    footerTagline: f.optStr(500),
    copyrightText: f.optStr(500),
    developerName: f.optStr(),
    developerUrl: f.optUrl(),
    developerLogoUrl: f.optUrl(),
    contactEmail: z.preprocess((v) => (v === '' ? null : v), z.email().nullable()).optional(),
    contactPhone: f.optStr(),
    address: f.optText(2000),
    seoTitleTemplate: f.optStr(),
    defaultMetaDescription: f.optStr(500),
    defaultOgImageUrl: f.optUrl(),
    analyticsId: f.optStr(),
    maintenanceMode: f.bool(),
  })

  app.get('/site-settings', async () => app.db.siteSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }))

  app.patch('/site-settings', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const input = siteFields.partial().parse(req.body)
    const existing = await app.db.siteSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
    const issues = checkLink({ ...existing, ...input }, 'headerCta')
    if (issues.length) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid input', issues })
    return app.db.$transaction(async (tx) => {
      await tx.contentRevision.create({ data: { entityType: 'siteSetting', entityId: '1', snapshot: JSON.parse(JSON.stringify(existing)), createdById: req.auth!.id } })
      const updated = await tx.siteSetting.update({ where: { id: 1 }, data: { ...input, updatedById: req.auth!.id } })
      await tx.auditLog.create({ data: { actorId: req.auth!.id, action: 'siteSetting.update', entityType: 'siteSetting', entityId: '1', diff: JSON.parse(JSON.stringify(input)), ip: req.ip } })
      return updated
    })
  })

  // ---- media library (files on this server for now) ------------------------
  const storage = createStorage(env)
  await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 } })

  app.post('/media', { preHandler: app.requireRole('EDITOR') }, async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.badRequest('Attach a file in the "file" field')
    const buffer = await file.toBuffer() // throws 413 above MAX_UPLOAD_MB
    const type = sniffType(buffer)
    if (!type) return reply.code(415).send({ statusCode: 415, error: 'Unsupported Media Type', message: 'Upload a PNG, JPEG, WebP, GIF, AVIF or PDF file' })
    const fieldValue = (name: string) => {
      const v = file.fields[name]
      return v && !Array.isArray(v) && 'value' in v ? String(v.value) : undefined
    }
    const meta = z
      .object({ folder: z.string().regex(/^[a-z0-9-]{1,40}$/, 'Folder: lowercase letters, numbers, dashes').default('general'), alt: z.string().max(500).optional() })
      .parse({ folder: fieldValue('folder'), alt: fieldValue('alt') })
    const key = newKey(meta.folder, type.ext)
    const stored = await storage.put(key, Readable.from(buffer))
    const size = type.mime.startsWith('image/') ? imageSize(buffer) : null
    try {
      const asset = await app.db.mediaAsset.create({
        data: {
          key,
          url: stored.url,
          mime: type.mime,
          sizeBytes: stored.sizeBytes,
          width: size?.width ?? null,
          height: size?.height ?? null,
          alt: meta.alt ?? null,
          folder: meta.folder,
          uploadedById: req.auth!.id,
        },
      })
      await app.audit(req, { action: 'media.upload', entityType: 'media', entityId: asset.id, diff: { key, mime: type.mime, originalName: file.filename } })
      return reply.code(201).send(asset)
    } catch (err) {
      await storage.delete(key)
      throw err
    }
  })

  app.get('/media', async (req) => {
    const q = z
      .object({
        folder: z.string().max(40).optional(),
        q: z.string().max(100).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(60),
      })
      .parse(req.query)
    const where = { ...(q.folder ? { folder: q.folder } : {}), ...(q.q ? { OR: [{ alt: { contains: q.q } }, { key: { contains: q.q } }] } : {}) }
    const [items, total] = await Promise.all([
      app.db.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      app.db.mediaAsset.count({ where }),
    ])
    return { items, total, page: q.page, pageSize: q.pageSize }
  })

  app.patch('/media/:id', { preHandler: app.requireRole('EDITOR') }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z.object({ alt: f.optStr(500), folder: z.string().regex(/^[a-z0-9-]{1,40}$/).optional() }).parse(req.body)
    return app.db.mediaAsset.update({ where: { id }, data: body })
  })

  /** Deletes the file too. Pages that still use its URL will show a broken image, so the admin UI warns first. */
  app.delete('/media/:id', { preHandler: app.requireRole('EDITOR') }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const asset = await app.db.mediaAsset.delete({ where: { id } })
    await storage.delete(asset.key)
    await app.audit(req, { action: 'media.delete', entityType: 'media', entityId: id, diff: asset })
    return reply.code(204).send()
  })

  // ---- users: students (SUPPORT reads, ADMIN enables/disables) and staff (SUPER_ADMIN) ----
  const userOut = (u: { id: string; name: string; email: string | null; mobile: string | null; role: Role; isActive: boolean; createdAt: Date; lastLoginAt: Date | null }) => ({
    ...sessionUser(u),
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  })

  app.get('/users', async (req) => {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        role: roleSchema.optional(),
        staff: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(req.query)
    const where = {
      ...(q.role ? { role: q.role } : q.staff ? { role: { not: 'STUDENT' as const } } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }, { mobile: { contains: q.q } }] } : {}),
    }
    const [items, total] = await Promise.all([
      app.db.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      app.db.user.count({ where }),
    ])
    return { items: items.map(userOut), total, page: q.page, pageSize: q.pageSize }
  })

  app.get('/users/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const user = await app.db.user.findUnique({ where: { id }, include: { _count: { select: { orders: true, enrollments: true, sessions: true } } } })
    if (!user) return reply.notFound()
    return { ...userOut(user), counts: user._count }
  })

  /** Create a staff account (SUPER_ADMIN). Students sign up themselves. */
  app.post('/users', { preHandler: app.requireRole('SUPER_ADMIN') }, async (req, reply) => {
    const body = z.object({ name: personName, identifier, password, role: roleSchema.exclude(['STUDENT']) }).parse(req.body)
    const contact = body.identifier.kind === 'email' ? { email: body.identifier.value } : { mobile: body.identifier.value }
    const user = await app.db.user.create({ data: { name: body.name, ...contact, role: body.role, passwordHash: await hashPassword(body.password) } })
    await app.audit(req, { action: 'user.create', entityType: 'user', entityId: user.id, diff: { role: body.role, ...contact } })
    return reply.code(201).send(userOut(user))
  })

  app.patch('/users/:id', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z.object({ name: personName.optional(), isActive: z.boolean().optional(), role: roleSchema.optional(), password: password.optional() }).parse(req.body)
    const me = req.auth!
    const target = await app.db.user.findUnique({ where: { id } })
    if (!target) return reply.notFound()

    const forbidden = (message: string) => reply.code(403).send({ statusCode: 403, error: 'Forbidden', message })
    const touchesStaff = target.role !== 'STUDENT' || (body.role && body.role !== 'STUDENT')
    if (touchesStaff && !hasRole(me.role, 'SUPER_ADMIN')) return forbidden('Only a super admin can change staff accounts.')
    if (id === me.id && (body.isActive === false || (body.role && roleRank[body.role] < roleRank[me.role]))) {
      return forbidden('You cannot disable or demote your own account.')
    }
    if (target.role === 'SUPER_ADMIN' && (body.isActive === false || (body.role && body.role !== 'SUPER_ADMIN'))) {
      const others = await app.db.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } } })
      if (others === 0) return forbidden('Keep at least one active super admin.')
    }

    const updated = await app.db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.role ? { role: body.role } : {}),
          ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
        },
      })
      // disabling, a role change or a new password logs the account out everywhere
      if (body.isActive === false || body.role || body.password) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      return u
    })
    const { password: _pw, ...logged } = body
    await app.audit(req, { action: 'user.update', entityType: 'user', entityId: id, diff: { ...logged, ...(body.password ? { password: 'changed' } : {}) } })
    return userOut(updated)
  })

  // ---- waitlist -------------------------------------------------------------
  app.get('/waitlist', async (req, reply) => {
    const q = z.object({ format: z.enum(['json', 'csv']).default('json'), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query)
    if (q.format === 'csv') {
      const rows = await app.db.waitlistEntry.findMany({ orderBy: { createdAt: 'asc' } })
      const csvCell = (v: string) => (/[",\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : v)
      const csv = ['email,source,created_at', ...rows.map((r) => [r.email, r.source, r.createdAt.toISOString()].map(csvCell).join(','))].join('\n')
      await app.audit(req, { action: 'waitlist.export', entityType: 'waitlist', diff: { rows: rows.length } })
      return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="waitlist.csv"').send(csv)
    }
    const [items, total] = await Promise.all([
      app.db.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      app.db.waitlistEntry.count(),
    ])
    return { items, total, page: q.page, pageSize: q.pageSize }
  })

  app.delete('/waitlist/:id', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await app.db.waitlistEntry.delete({ where: { id } })
    await app.audit(req, { action: 'waitlist.delete', entityType: 'waitlist', entityId: id })
    return reply.code(204).send()
  })

  // ---- audit log (ADMIN) ------------------------------------------------------
  app.get('/audit-logs', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const q = z
      .object({
        entityType: z.string().max(64).optional(),
        entityId: z.string().max(64).optional(),
        actorId: z.string().max(64).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(req.query)
    const where = { ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.entityId ? { entityId: q.entityId } : {}), ...(q.actorId ? { actorId: q.actorId } : {}) }
    const [items, total] = await Promise.all([
      app.db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      app.db.auditLog.count({ where }),
    ])
    const actors = await app.db.user.findMany({ where: { id: { in: [...new Set(items.map((i) => i.actorId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })
    const names = new Map(actors.map((a) => [a.id, a.name]))
    return { items: items.map((i) => ({ ...i, actorName: i.actorId ? (names.get(i.actorId) ?? null) : null })), total, page: q.page, pageSize: q.pageSize }
  })

  // ---- revisions (undo) -------------------------------------------------------
  app.get('/revisions', { preHandler: app.requireRole('EDITOR') }, async (req) => {
    const q = z.object({ entityType: z.string().max(64), entityId: z.string().max(64), take: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query)
    return { items: await app.db.contentRevision.findMany({ where: { entityType: q.entityType, entityId: q.entityId }, orderBy: { createdAt: 'desc' }, take: q.take }) }
  })

  /** Puts a row back the way it was in that revision (recreates it if it was deleted). The current state is saved first, so a restore can be undone too. */
  app.post('/revisions/:id/restore', { preHandler: app.requireRole('EDITOR') }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const rev = await app.db.contentRevision.findUnique({ where: { id } })
    if (!rev) return reply.notFound()
    const snapshot = rev.snapshot as Record<string, unknown>

    if (rev.entityType === 'siteSetting') {
      if (!hasRole(req.auth!.role, 'ADMIN')) return reply.forbidden()
      const current = await app.db.siteSetting.findUnique({ where: { id: 1 } })
      await app.db.$transaction([
        app.db.contentRevision.create({ data: { entityType: 'siteSetting', entityId: '1', snapshot: JSON.parse(JSON.stringify(current)), createdById: req.auth!.id } }),
        app.db.siteSetting.update({ where: { id: 1 }, data: restorable(snapshot) as never }),
      ])
      await app.audit(req, { action: 'siteSetting.restore', entityType: 'siteSetting', entityId: '1', diff: { revisionId: id } })
      return { ok: true }
    }

    const resource = registry.get(rev.entityType)
    if (!resource) return reply.badRequest(`Cannot restore ${rev.entityType}`)
    if (!hasRole(req.auth!.role, resource.write ?? 'EDITOR')) return reply.forbidden()
    const model = (app.db as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[resource.model]!
    const current = (await model.findUnique!({ where: { id: rev.entityId } })) as Record<string, unknown> | null
    await app.db.$transaction(async (tx) => {
      const m = (tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[resource.model]!
      if (current) {
        await tx.contentRevision.create({ data: { entityType: rev.entityType, entityId: rev.entityId, snapshot: JSON.parse(JSON.stringify(current)), createdById: req.auth!.id } })
        await m.update!({ where: { id: rev.entityId }, data: restorable(snapshot) })
      } else {
        await m.create!({ data: { id: rev.entityId, ...restorable(snapshot) } })
      }
      await tx.auditLog.create({
        data: { actorId: req.auth!.id, action: `${rev.entityType}.restore`, entityType: rev.entityType, entityId: rev.entityId, diff: { revisionId: id, recreated: !current }, ip: req.ip },
      })
    })
    return { ok: true, recreated: !current }
  })
}
