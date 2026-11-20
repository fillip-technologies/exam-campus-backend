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
        papers: {
          create: [
            {
              year: 2025,
              stage: 'Prelims',
              shift: 'Shift 1',
              type: 'Memory Based',
              heldOn: new Date('2025-03-08T00:00:00Z'),
              questions: 100,
              marks: 100,
              durationMinutes: 60,
              languages: ['English', 'Hindi'],
              viewUrl: 'https://cdn.example.com/p1.pdf',
              practiceUrl: '/free-test/zz-test-free',
            },
            { year: 2024, stage: 'Mains', viewUrl: 'https://cdn.example.com/hidden.pdf', visible: false },
          ],
        },
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

  it('serves visible previous year papers with their details', async () => {
    const body = (await get('/exams/zz-test-exam')).json()
    expect(body.previousYearPapers).toHaveLength(1) // hidden paper left out
    expect(body.previousYearPapers[0]).toMatchObject({
      year: 2025,
      stage: 'Prelims',
      shift: 'Shift 1',
      type: 'Memory Based',
      heldOn: '2025-03-08',
      questions: 100,
      marks: 100,
      durationMinutes: 60,
      languages: ['English', 'Hindi'],
      viewUrl: 'https://cdn.example.com/p1.pdf',
      downloadUrl: 'https://cdn.example.com/p1.pdf', // one PDF serves both buttons
      practiceUrl: '/free-test/zz-test-free',
    })
    const dir = (await get('/exams')).json()
    const listed = dir.categories.flatMap((c: { exams: { slug: string; paperCount: number }[] }) => c.exams).find((e: { slug: string }) => e.slug === 'zz-test-exam')
    expect(listed.paperCount).toBe(1)
  })

  it('serves courses, faculty and live coupons (picked or for all)', async () => {
    try {
      await app.db.exam.update({
        where: { id: ids.exam },
        data: {
          demoVideoUrl: 'https://www.youtube.com/watch?v=abc',
          courses: {
            create: [
              { title: 'ZZ Course', mode: 'HYBRID', price: 1000, mrp: 2000, images: ['/uploads/a.png'], demoVideoUrl: 'https://youtu.be/xyz', status: 'PUBLISHED' },
              { title: 'ZZ Other Course', price: 1000, mrp: 1000, status: 'PUBLISHED', sort: 1 },
              { title: 'ZZ Draft Course', price: 1, mrp: 1, status: 'DRAFT' },
            ],
          },
          faculty: { create: [{ name: 'ZZ Teacher', subject: 'Quant' }, { name: 'ZZ Hidden', visible: false }] },
        },
      })
      const course = await app.db.course.findFirstOrThrow({ where: { examId: ids.exam, title: 'ZZ Course' } })
      const series = await app.db.testSeries.findUniqueOrThrow({ where: { slug: 'zz-test-series' } })
      // picked for one course and the series
      await app.db.coupon.create({
        data: {
          code: 'ZZTEST10',
          type: 'PERCENT',
          value: 10,
          label: 'ZZ offer',
          validTo: new Date('2099-01-01T00:00:00Z'),
          courses: { create: [{ courseId: course.id }] },
          series: { create: [{ seriesId: series.id }] },
        },
      })
      // expired, for every course: never shows
      await app.db.coupon.create({ data: { code: 'ZZTESTOLD', type: 'FLAT', value: 900, allCourses: true, validTo: new Date('2000-01-01T00:00:00Z') } })
      app.cache.invalidate()

      let hub = (await get('/exams/zz-test-exam')).json()
      expect(hub.demoVideoUrl).toBe('https://www.youtube.com/watch?v=abc')
      expect(hub.courses.map((c: { title: string }) => c.title)).toEqual(['ZZ Course', 'ZZ Other Course']) // draft hidden
      expect(hub.courses[0]).toMatchObject({
        mode: 'HYBRID',
        media: [
          { type: 'image', url: '/uploads/a.png' },
          { type: 'youtube', url: 'https://youtu.be/xyz' },
        ],
        coupon: { code: 'ZZTEST10', discountPercent: 10, discountAmount: null, label: 'ZZ offer', validTill: '2099-01-01' },
        enrollUrl: '/enroll/zz-test-exam',
      })
      expect(hub.courses[1].coupon).toBeNull() // not picked for it
      expect(hub.faculty.map((t: { name: string }) => t.name)).toEqual(['ZZ Teacher'])
      expect(hub.testSeries[0].coupon.code).toBe('ZZTEST10')
      const card = (await get('/series?tab=zz-test-tab')).json().items.find((i: { slug: string }) => i.slug === 'zz-test-series')
      expect(card.coupon.code).toBe('ZZTEST10')

      // a live coupon for all courses: every course gets one, and the bigger saving wins (₹200 off > 10% of ₹1000)
      await app.db.coupon.create({ data: { code: 'ZZTESTALL', type: 'FLAT', value: 200, allCourses: true } })
      app.cache.invalidate()
      hub = (await get('/exams/zz-test-exam')).json()
      expect(hub.courses.map((c: { coupon: { code: string } }) => c.coupon.code)).toEqual(['ZZTESTALL', 'ZZTESTALL'])
      expect(hub.testSeries[0].coupon.code).toBe('ZZTEST10') // "all courses" does not touch test series
    } finally {
      await app.db.coupon.deleteMany({ where: { code: { startsWith: 'ZZTEST' } } })
      await app.db.course.deleteMany({ where: { examId: ids.exam } })
      await app.db.faculty.deleteMany({ where: { examId: ids.exam } })
      await app.db.exam.update({ where: { id: ids.exam }, data: { demoVideoUrl: null } })
      app.cache.invalidate()
    }
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

  it('sends each button to its own item\'s redirect link, else our page', async () => {
    const card = async () => (await get('/series?tab=zz-test-tab')).json().items.find((i: { slug: string }) => i.slug === 'zz-test-series')
    const hub = async () => (await get('/exams/zz-test-exam')).json()
    try {
      await app.db.course.createMany({
        data: [
          { examId: ids.exam, title: 'ZZ Linked Course', price: 1, mrp: 1, status: 'PUBLISHED', redirectUrl: 'https://other.example.com/course' },
          { examId: ids.exam, title: 'ZZ Plain Course', price: 1, mrp: 1, status: 'PUBLISHED', sort: 1 },
        ],
      })
      await app.db.testSeries.update({ where: { slug: 'zz-test-series' }, data: { redirectUrl: 'https://other.example.com/series' } })
      await app.db.freeTest.update({ where: { slug: 'zz-test-free' }, data: { redirectUrl: 'https://other.example.com/free' } })
      await app.db.exam.update({ where: { id: ids.exam }, data: { redirectUrl: 'https://other.example.com/exam' } })
      app.cache.invalidate()

      const h = await hub()
      // every course / series has its own link; one without a link keeps our page
      expect(h.courses.map((c: { enrollUrl: string }) => c.enrollUrl)).toEqual(['https://other.example.com/course', '/enroll/zz-test-exam'])
      expect(h.courses[0].external).toBe(true)
      expect(h.testSeries[0]).toMatchObject({ enrollUrl: 'https://other.example.com/series', detailsUrl: 'https://other.example.com/series', external: true })
      expect(h.freeTests[0].startUrl).toBe('https://other.example.com/free')
      expect(h.redirectUrl).toBe('https://other.example.com/exam')
      expect(await card()).toMatchObject({ href: 'https://other.example.com/series', external: true, examHref: 'https://other.example.com/exam' })
      expect((await get('/products/zz-test-series')).json().redirectUrl).toBe('https://other.example.com/series')
      expect((await get('/free-tests/zz-test-free')).json().redirectUrl).toBe('https://other.example.com/free')
      expect((await get('/search?q=zzalias')).json().results[0].href).toBe('https://other.example.com/exam')
    } finally {
      await app.db.course.deleteMany({ where: { examId: ids.exam } })
      await app.db.testSeries.update({ where: { slug: 'zz-test-series' }, data: { redirectUrl: null } })
      await app.db.freeTest.update({ where: { slug: 'zz-test-free' }, data: { redirectUrl: null } })
      await app.db.exam.update({ where: { id: ids.exam }, data: { redirectUrl: null } })
      app.cache.invalidate()
    }
    // cleared links bring our own pages back
    expect((await card()).href).toBe('/enroll/zz-test-series')
    expect((await hub()).redirectUrl).toBeNull()
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
