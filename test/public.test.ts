import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { createMemoryCache } from '../src/lib/cache.js'
import { searchIndex, type SearchEntry } from '../src/modules/public/search.js'

try {
  process.loadEnvFile('.env')
} catch {
  // CI sets the variables directly
}

/**
 * API tests create their own rows (slugs start with "zz-test") and remove them afterwards,
 * so they run on an empty CI database and next to seeded dev data alike.
 */
describe('public API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const ids = { category: '', org: '', exam: '', draftExam: '', tab: '' }

  beforeAll(async () => {
    app = await buildApp({ env: { ...loadEnv(), NODE_ENV: 'test', LOG_LEVEL: 'silent' } })
    const db = app.db
    await cleanup()
    const category = await db.examCategory.create({ data: { slug: 'zz-test-cat', label: 'ZZ Test', sort: 999 } })
    const org = await db.examOrganization.create({ data: { key: 'zz-test-org', name: 'ZZ Org' } })
    const exam = await db.exam.create({
      data: {
        slug: 'zz-test-exam',
        name: 'ZZ Test Exam',
        status: 'PUBLISHED',
        categoryId: category.id,
        orgId: org.id,
        aliases: ['zzalias'],
        dates: { create: [{ event: 'Exam Date', date: null }] },
        resources: { create: [{ type: 'Practice', title: 'Pattern', linkType: 'ANCHOR', linkRef: 'pattern' }] },
        series: {
          create: [
            { slug: 'zz-test-series', title: 'ZZ Series', price: 100, mrp: 400, sectionalTests: 5, isPrimary: true, status: 'PUBLISHED' },
            { slug: 'zz-test-series-draft', title: 'ZZ Draft Series', price: 1, mrp: 1, status: 'DRAFT' },
          ],
        },
        freeTests: { create: [{ slug: 'zz-test-free', title: 'ZZ Free', questions: 10, durationMinutes: 15, status: 'PUBLISHED' }] },
      },
    })
    const draft = await db.exam.create({
      data: { slug: 'zz-test-draft', name: 'ZZ Draft', status: 'DRAFT', categoryId: category.id, orgId: org.id },
    })
    // a resource linking to the draft exam: must resolve to null
    await db.examResource.create({ data: { examId: exam.id, type: 'Related', title: 'Draft link', linkType: 'EXAM', linkRef: draft.id, sort: 1 } })
    const tab = await db.seriesTab.create({ data: { key: 'zz-test-tab', label: 'ZZ', heading: 'ZZ', rule: 'HAS_SECTIONAL', sort: 999 } })
    await db.slugRedirect.create({ data: { entityType: 'exam', oldSlug: 'zz-test-old', newSlug: 'zz-test-exam' } })
    Object.assign(ids, { category: category.id, org: org.id, exam: exam.id, draftExam: draft.id, tab: tab.id })
    app.cache.invalidate()
  })

  async function cleanup() {
    const db = app.db
    await db.slugRedirect.deleteMany({ where: { oldSlug: { startsWith: 'zz-test' } } })
    await db.seriesTab.deleteMany({ where: { key: { startsWith: 'zz-test' } } })
    await db.exam.deleteMany({ where: { slug: { startsWith: 'zz-test' } } })
    await db.examCategory.deleteMany({ where: { slug: { startsWith: 'zz-test' } } })
    await db.examOrganization.deleteMany({ where: { key: { startsWith: 'zz-test' } } })
  }

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  const get = (url: string) => app.inject({ method: 'GET', url: `/api/v1/public${url}` })

  it('serves a published exam hub with resolved links', async () => {
    const res = await get('/exams/zz-test-exam')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('ZZ Test Exam')
    expect(body.importantDates[0]).toEqual({ event: 'Exam Date', date: null, highlight: false })
    expect(body.testSeries.map((s: { id: string }) => s.id)).toEqual(['zz-test-series']) // drafts hidden
    expect(body.resources.map((r: { href: string | null }) => r.href)).toEqual(['#pattern', null]) // draft target -> null
    expect(body.freeTests[0].startUrl).toBe('/free-test/zz-test-free')
  })

  it('hides drafts and points renamed slugs to the new path', async () => {
    expect((await get('/exams/zz-test-draft')).statusCode).toBe(404)
    const moved = await get('/exams/zz-test-old')
    expect(moved.statusCode).toBe(404)
    expect(moved.json().redirect).toBe('/exams/zz-test-exam')
  })

  it('applies the tab rule on the server', async () => {
    const res = await get('/series?tab=zz-test-tab')
    expect(res.statusCode).toBe(200)
    const slugs = res.json().items.map((i: { slug: string }) => i.slug)
    expect(slugs).toContain('zz-test-series')
    expect(slugs).not.toContain('zz-test-series-draft')
    const card = res.json().items.find((i: { slug: string }) => i.slug === 'zz-test-series')
    expect(card).toMatchObject({ price: 100, mrp: 400, discountPercent: 75, validity: '12 Months', href: '/enroll/zz-test-series', freeTests: 1 })
  })

  it('resolves enroll products like lib/products.js', async () => {
    expect((await get('/products/zz-test-series')).json().title).toBe('ZZ Series')
    expect((await get('/products/zz-test-exam')).json().slug).toBe('zz-test-series') // exam slug -> primary series
    expect((await get('/products/zz-test-series-draft')).statusCode).toBe(404)
  })

  it('finds exams by alias in search', async () => {
    const res = await get('/search?q=zzalias')
    expect(res.json().results[0]).toMatchObject({ name: 'ZZ Test Exam', href: '/exams/zz-test-exam' })
  })

  it('serves cached content until invalidated', async () => {
    await get('/exams/zz-test-exam')
    await app.db.exam.update({ where: { id: ids.exam }, data: { name: 'ZZ Renamed' } })
    expect((await get('/exams/zz-test-exam')).json().name).toBe('ZZ Test Exam')
    app.cache.invalidate()
    expect((await get('/exams/zz-test-exam')).json().name).toBe('ZZ Renamed')
  })

  it('validates visitor forms', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/v1/public/contact', payload: { name: 'A', message: 'hi' } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().issues[0].path).toBe('email')
  })
})

describe('search ranking', () => {
  const entry = (name: string, terms: string[], href: string | null = '/x'): SearchEntry => ({
    type: 'exam',
    name,
    category: 'C',
    slug: name,
    href,
    terms,
  })
  it('ranks exact and prefix matches first and matches short words', () => {
    const index = [entry('State Police', ['state police']), entry('SBI PO', ['sbi po']), entry('PO', ['po'])]
    expect(searchIndex(index, 'po').map((r) => r.name)).toEqual(['PO', 'SBI PO', 'State Police'])
    expect(searchIndex(index, '  ')).toEqual([])
  })
})

describe('cache', () => {
  it('does not keep a result that was loading while a write invalidated the cache', async () => {
    const cache = createMemoryCache()
    let release!: () => void
    const slow = cache.wrap('k', () => new Promise<number>((r) => (release = () => r(1))))
    cache.invalidate()
    release()
    expect(await slow).toBe(1)
    expect(await cache.wrap('k', async () => 2)).toBe(2)
  })
})
