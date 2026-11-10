import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { slug as slugSchema } from '../../shared/schemas.js'
import { getFreeTestBySlug, getFreeTests } from './freeTests.js'
import { getHome } from './home.js'
import { findRedirect, getClassHub, getExamDirectory, getExamHub, getPage, getProduct } from './hubs.js'
import { getLayout } from './layout.js'
import { buildSearchIndex, searchIndex } from './search.js'
import { getSeriesCards } from './series.js'

const slugParams = z.object({ slug: slugSchema })
const idParams = z.object({ id: z.string().min(1).max(64) })

/** Public GETs: cacheable by browsers/CDN for a minute, then served stale while revalidating (ETag makes that cheap). */
const cacheable = (reply: FastifyReply) => reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300')

/**
 * /api/v1/public/*: no login. Every GET goes through `app.cache`, cleared on any admin write.
 * Unknown or unpublished slugs answer 404; a renamed slug answers 404 with `redirect` (the new site path).
 */
export const publicRoutes: FastifyPluginAsync = async (app) => {
  const cached = <T>(key: string, load: () => Promise<T>) => app.cache.wrap(key, load)

  const notFound = async (reply: FastifyReply, entityType?: string, slug?: string, toPath?: (s: string) => string) => {
    const newSlug = entityType && slug ? await cached(`redirect:${entityType}:${slug}`, () => findRedirect(app.db, entityType, slug)) : null
    return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Not found',
      ...(newSlug && toPath ? { redirect: toPath(newSlug) } : {}),
    })
  }

  app.get('/layout', async (_req, reply) => {
    cacheable(reply)
    return cached('layout', () => getLayout(app.db))
  })

  app.get('/home', async (_req, reply) => {
    cacheable(reply)
    return cached('home', () => getHome(app.db))
  })

  app.get('/series', async (req, reply) => {
    const q = z
      .object({
        category: slugSchema.optional(),
        tab: slugSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query)
    const result = await cached(`series:${q.category ?? ''}:${q.tab ?? ''}:${q.limit ?? ''}`, () => getSeriesCards(app.db, q))
    if (!result) return notFound(reply)
    cacheable(reply)
    return result
  })

  app.get('/exams', async (_req, reply) => {
    cacheable(reply)
    return cached('exams', () => getExamDirectory(app.db))
  })

  app.get('/exams/:slug', async (req, reply) => {
    const { slug } = slugParams.parse(req.params)
    const exam = await cached(`exam:${slug}`, () => getExamHub(app.db, slug))
    if (!exam) return notFound(reply, 'exam', slug, (s) => `/exams/${s}`)
    cacheable(reply)
    return exam
  })

  app.get('/classes/:slug', async (req, reply) => {
    const { slug } = slugParams.parse(req.params)
    const cls = await cached(`class:${slug}`, () => getClassHub(app.db, slug))
    if (!cls) return notFound(reply, 'class', slug, (s) => `/academic/${s}`)
    cacheable(reply)
    return cls
  })

  app.get('/free-tests', async (req, reply) => {
    const { category } = z.object({ category: slugSchema.optional() }).parse(req.query)
    cacheable(reply)
    return cached(`free-tests:${category ?? ''}`, () => getFreeTests(app.db, category))
  })

  app.get('/free-tests/:slug', async (req, reply) => {
    const { slug } = slugParams.parse(req.params)
    const test = await cached(`free-test:${slug}`, () => getFreeTestBySlug(app.db, slug))
    if (!test) return notFound(reply)
    cacheable(reply)
    return test
  })

  app.get('/products/:slug', async (req, reply) => {
    const { slug } = slugParams.parse(req.params)
    const product = await cached(`product:${slug}`, () => getProduct(app.db, slug))
    if (!product) return notFound(reply, 'series', slug, (s) => `/enroll/${s}`)
    cacheable(reply)
    return product
  })

  app.get('/pages/:slug', async (req, reply) => {
    const { slug } = slugParams.parse(req.params)
    const page = await cached(`page:${slug}`, () => getPage(app.db, slug))
    if (!page) return notFound(reply, 'page', slug, (s) => `/pages/${s}`)
    cacheable(reply)
    return page
  })

  app.get('/search', async (req, reply) => {
    const { q, limit } = z
      .object({ q: z.string().max(100).default(''), limit: z.coerce.number().int().min(1).max(20).default(8) })
      .parse(req.query)
    const index = await cached('search-index', () => buildSearchIndex(app.db))
    cacheable(reply)
    return { query: q, results: searchIndex(index, q, limit) }
  })

  // ---- writes from visitors (rate limited) --------------------------------

  const formLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

  app.post('/waitlist', formLimit, async (req, reply) => {
    const body = z.object({ email: z.email().max(191).toLowerCase(), source: z.string().max(40).optional() }).parse(req.body)
    // Same answer whether or not the email is already on the list (does not reveal who signed up).
    await app.db.waitlistEntry.upsert({
      where: { email: body.email },
      create: { email: body.email, source: body.source ?? 'app' },
      update: {},
    })
    return reply.code(201).send({ ok: true })
  })

  app.post('/contact', formLimit, async (req, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(191),
        email: z.email().max(191).optional(),
        mobile: z
          .string()
          .trim()
          .regex(/^\+?[0-9 ]{10,15}$/, 'Enter a valid mobile number')
          .optional(),
        subject: z.string().trim().max(500).optional(),
        message: z.string().trim().min(1).max(5000),
      })
      .refine((v) => v.email || v.mobile, { message: 'Give an email or a mobile number', path: ['email'] })
      .parse(req.body)
    await app.db.contactMessage.create({ data: body })
    return reply.code(201).send({ ok: true })
  })

  app.post('/banners/:id/click', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = idParams.parse(req.params)
    await app.db.banner.updateMany({ where: { id }, data: { clicks: { increment: 1 } } })
    return reply.code(204).send()
  })
}
