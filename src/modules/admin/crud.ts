import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z, type ZodObject, type ZodRawShape } from 'zod'
import type { Db } from '../../lib/db.js'
import type { Role } from '../../shared/schemas.js'

/** A Prisma client or the client inside a transaction. */
export type Tx = Omit<Db, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
type Row = Record<string, unknown> & { id: string }
type Issue = { path: string; message: string }

/** Thrown by `rules` for cross-field problems; answered as 400 with field issues. */
export class InputError extends Error {
  constructor(public issues: Issue[]) {
    super('Invalid input')
  }
}

export interface Resource {
  /** URL segment: /admin/<path> */
  path: string
  /** Prisma model delegate name ("exam", "navLink") */
  model: string
  /** stored in AuditLog / ContentRevision ("exam") */
  entityType: string
  /** fields accepted on create; update accepts the same fields, all optional */
  fields: ZodObject<ZodRawShape>
  /** input keys handled by `afterWrite` instead of being columns (e.g. relatedExamIds) */
  relationKeys?: string[]
  /**
   * Cross-field rules on the merged row (existing + input). Return issues to reject the write.
   * `tx` lets a rule read other rows (e.g. check a parent exists).
   */
  rules?: (row: Record<string, unknown>, ctx: { tx: Tx; existing: Row | null }) => Issue[] | Promise<Issue[]>
  /** runs inside the write transaction (relation arrays, primary-series switch, slug redirects ...) */
  afterWrite?: (tx: Tx, row: Row, input: Record<string, unknown>, existing: Row | null) => Promise<void>
  /** fields searched by ?q= (contains) */
  search?: string[]
  /** query-string filters with exact match (?examId=..&status=..) */
  filters?: Record<string, z.ZodType>
  orderBy?: unknown
  /** include for GET /:id (and list when listInclude not given) */
  include?: unknown
  listInclude?: unknown
  /** has a `sort` column: PATCH /reorder */
  sortable?: boolean
  /** has a PublishStatus `status`: POST /:id/publish | /archive */
  publishable?: boolean
  /** also has a `publishedAt` column, stamped on first publish (Exam, AcademicClass) */
  stampsPublishedAt?: boolean
  /** read permission (default SUPPORT: support staff can look at content) */
  read?: Role
  /** write permission (default EDITOR) */
  write?: Role
  /** extra fields added on create (defaults computed on the server) */
  onCreate?: (input: Record<string, unknown>) => Record<string, unknown>
  /** serialise a row for the response (default: as is) */
  present?: (row: Row) => unknown
}

const delegate = (tx: Tx, model: string) => (tx as unknown as Record<string, Record<string, (args?: unknown) => Promise<unknown>>>)[model]!

const toJson = (v: unknown) => JSON.parse(JSON.stringify(v ?? null))

/** Changed fields only: { name: [before, after] } */
function diffOf(before: Row, after: Row) {
  const out: Record<string, [unknown, unknown]> = {}
  for (const k of Object.keys(after)) {
    if (k === 'updatedAt') continue
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = [before[k], after[k]]
  }
  return out
}

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
})

/**
 * Registers REST endpoints for one resource under the current prefix:
 *   GET    /<path>?q=&page=&pageSize=&<filters>   -> { items, total, page, pageSize }
 *   GET    /<path>/:id
 *   POST   /<path>                               -> 201 row
 *   PATCH  /<path>/:id                           -> row
 *   DELETE /<path>/:id                           -> 204
 *   PATCH  /<path>/reorder   { ids: [...] }      -> sort = position     (sortable)
 *   POST   /<path>/:id/publish | /archive        -> row                  (publishable)
 * Every write runs in a transaction that also stores a ContentRevision (the row before the change) and an AuditLog row.
 */
export function registerResource(app: FastifyInstance, r: Resource, registry: Map<string, Resource>) {
  registry.set(r.entityType, r)
  const read = app.requireRole(r.read ?? 'SUPPORT')
  const write = app.requireRole(r.write ?? 'EDITOR')
  const createSchema = r.fields
  const updateSchema = r.fields.partial()
  const relationKeys = new Set(r.relationKeys ?? [])
  const present = (row: unknown) => (r.present ? r.present(row as Row) : row)
  const filterSchema = z.object(r.filters ?? {})

  const splitInput = (input: Record<string, unknown>) => {
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) if (!relationKeys.has(k) && v !== undefined) data[k] = v
    return data
  }

  async function validate(tx: Tx, merged: Record<string, unknown>, existing: Row | null) {
    const issues = (await r.rules?.(merged, { tx, existing })) ?? []
    if (issues.length) throw new InputError(issues)
  }

  const publishedAtFor = (data: Record<string, unknown>, existing: Row | null) =>
    r.stampsPublishedAt && data.status === 'PUBLISHED' && !existing?.publishedAt ? { publishedAt: new Date() } : {}

  async function revision(tx: Tx, req: FastifyRequest, row: Row) {
    await tx.contentRevision.create({ data: { entityType: r.entityType, entityId: row.id, snapshot: toJson(row), createdById: req.auth?.id ?? null } })
  }
  async function audit(tx: Tx, req: FastifyRequest, action: string, entityId: string | null, diff: unknown) {
    await tx.auditLog.create({
      data: { actorId: req.auth?.id ?? null, action: `${r.entityType}.${action}`, entityType: r.entityType, entityId, diff: toJson(diff), ip: req.ip },
    })
  }

  // ---- list ----
  app.get(`/${r.path}`, { preHandler: read }, async (req) => {
    const q = listQuery.parse(req.query)
    const filters = filterSchema.parse(req.query) as Record<string, unknown>
    const where: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(filters)) if (v !== undefined) where[k] = v
    if (q.q && r.search?.length) where.OR = r.search.map((field) => ({ [field]: { contains: q.q } }))
    const model = delegate(app.db, r.model)
    const [items, total] = await Promise.all([
      model.findMany!({
        where,
        orderBy: r.orderBy ?? (r.sortable ? [{ sort: 'asc' }] : [{ id: 'asc' }]),
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        ...(r.listInclude ? { include: r.listInclude } : {}),
      }),
      model.count!({ where }),
    ])
    return { items: (items as Row[]).map(present), total, page: q.page, pageSize: q.pageSize }
  })

  // ---- reorder (registered before /:id routes) ----
  if (r.sortable) {
    app.patch(`/${r.path}/reorder`, { preHandler: write }, async (req) => {
      const { ids } = z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) }).parse(req.body)
      await app.db.$transaction(async (tx) => {
        const model = delegate(tx, r.model)
        for (const [i, id] of ids.entries()) await model.update!({ where: { id }, data: { sort: i } })
        await audit(tx, req, 'reorder', null, { ids })
      })
      return { ok: true }
    })
  }

  // ---- detail ----
  app.get(`/${r.path}/:id`, { preHandler: read }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const row = await delegate(app.db, r.model).findUnique!({ where: { id }, ...(r.include ? { include: r.include } : {}) })
    if (!row) return reply.notFound()
    return present(row)
  })

  // ---- create ----
  app.post(`/${r.path}`, { preHandler: write }, async (req, reply) => {
    const input = createSchema.parse(req.body) as Record<string, unknown>
    const row = await app.db.$transaction(async (tx) => {
      const data = { ...splitInput(input), ...(r.onCreate?.(input) ?? {}) }
      await validate(tx, data, null)
      const created = (await delegate(tx, r.model).create!({ data: { ...data, ...publishedAtFor(data, null) } })) as Row
      await r.afterWrite?.(tx, created, input, null)
      await audit(tx, req, 'create', created.id, data)
      return delegate(tx, r.model).findUnique!({ where: { id: created.id }, ...(r.include ? { include: r.include } : {}) })
    })
    return reply.code(201).send(present(row))
  })

  // ---- update ----
  app.patch(`/${r.path}/:id`, { preHandler: write }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const input = updateSchema.parse(req.body) as Record<string, unknown>
    const row = await app.db.$transaction(async (tx) => {
      const model = delegate(tx, r.model)
      const existing = (await model.findUnique!({ where: { id } })) as Row | null
      if (!existing) return null
      const data = splitInput(input)
      await validate(tx, { ...existing, ...data }, existing)
      await revision(tx, req, existing)
      const updated = (await model.update!({ where: { id }, data: { ...data, ...publishedAtFor(data, existing) } })) as Row
      await r.afterWrite?.(tx, updated, input, existing)
      await audit(tx, req, 'update', id, { ...diffOf(existing, updated), ...pick(input, relationKeys) })
      return model.findUnique!({ where: { id }, ...(r.include ? { include: r.include } : {}) })
    })
    if (!row) return reply.notFound()
    return present(row)
  })

  // ---- delete ----
  app.delete(`/${r.path}/:id`, { preHandler: write }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const found = await app.db.$transaction(async (tx) => {
      const model = delegate(tx, r.model)
      const existing = (await model.findUnique!({ where: { id } })) as Row | null
      if (!existing) return false
      await revision(tx, req, existing)
      await model.delete!({ where: { id } })
      await audit(tx, req, 'delete', id, existing)
      return true
    })
    if (!found) return reply.notFound()
    return reply.code(204).send()
  })

  // ---- publish / archive ----
  if (r.publishable) {
    for (const [action, status] of [
      ['publish', 'PUBLISHED'],
      ['archive', 'ARCHIVED'],
      ['unpublish', 'DRAFT'],
    ] as const) {
      app.post(`/${r.path}/:id/${action}`, { preHandler: write }, async (req, reply) => {
        const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
        const row = await app.db.$transaction(async (tx) => {
          const model = delegate(tx, r.model)
          const existing = (await model.findUnique!({ where: { id } })) as Row | null
          if (!existing) return null
          await validate(tx, { ...existing, status }, existing)
          await revision(tx, req, existing)
          await model.update!({ where: { id }, data: { status, ...publishedAtFor({ status }, existing) } })
          await audit(tx, req, action, id, { status: [existing.status, status] })
          return model.findUnique!({ where: { id }, ...(r.include ? { include: r.include } : {}) })
        })
        if (!row) return reply.notFound()
        return present(row)
      })
    }
  }
}

const pick = (o: Record<string, unknown>, keys: Set<string>) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.has(k)))

/** Columns a revision restore may write back (never ids or timestamps). */
export const restorable = (snapshot: Record<string, unknown>) => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = snapshot
  return rest
}
