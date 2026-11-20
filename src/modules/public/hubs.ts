import type { Prisma } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/db.js'
import { isoDate, list, strings, validityLabel } from '../../lib/format.js'
import { type CouponPicker, loadCoupons } from '../../lib/coupons.js'
import { classTarget, enrollTarget, freeTestTarget, LinkResolver, pageRedirect } from '../../lib/links.js'
import { menuExam, menuExamSelect } from './layout.js'

const bySort = { orderBy: { sort: 'asc' as const } }
const publishedSeries = {
  where: { status: 'PUBLISHED' as const },
  orderBy: [{ isPrimary: 'desc' as const }, { sort: 'asc' as const }],
}

/** A slug that no longer exists but was renamed: the caller answers 404 with `redirect` so the frontend can navigate. */
export async function findRedirect(db: Db, entityType: string, slug: string) {
  const r = await db.slugRedirect.findUnique({ where: { entityType_oldSlug: { entityType, oldSlug: slug } } })
  return r?.newSlug ?? null
}

/** Hub series in the shape of data/exams/sbiPo.js testSeries[]. */
const hubSeries = (s: Prisma.TestSeriesGetPayload<object>, coupons?: CouponPicker) => ({
  id: s.slug,
  slug: s.slug,
  image: s.posterUrl,
  title: s.title,
  subtitle: s.subtitle,
  totalTests: s.totalTests,
  fullLengthTests: s.fullLengthTests,
  sectionalTests: s.sectionalTests,
  practiceTests: s.topicTests,
  pyqTests: s.pyqTests,
  stats: list<{ label: string; value: string | number }>(s.extraStats),
  languages: strings(s.languages),
  validity: validityLabel(s.validityMonths),
  price: s.price,
  originalPrice: s.mrp,
  offer: s.offerLabel,
  coupon: coupons?.forSeries(s.id, s.price) ?? null,
  includes: strings(s.includes),
  isPrimary: s.isPrimary,
  enrollUrl: enrollTarget(s),
  // its own redirect link replaces "View details" too; otherwise it scrolls to the hub's series list
  detailsUrl: s.redirectUrl || '#test-series',
  external: Boolean(s.redirectUrl),
})

const hubFreeTest = (t: Prisma.FreeTestGetPayload<object>) => ({
  id: t.slug,
  title: t.title,
  questions: t.questions,
  durationMinutes: t.durationMinutes,
  type: t.testKindLabel,
  available: Boolean(t.testId),
  startUrl: freeTestTarget(t),
  external: Boolean(t.redirectUrl),
})

/** Hub course card (CoursesSection). Enroll: its own link, else the site default, else the exam's test series enroll page. */
const hubCourse = (c: Prisma.CourseGetPayload<object>, examSlug: string, coupons: CouponPicker) => {
  const images = strings(c.images).map((url) => ({ type: 'image' as const, url, alt: '' }))
  const video = c.demoVideoUrl ? [{ type: 'youtube' as const, url: c.demoVideoUrl, title: 'Demo class' }] : []
  const enrollUrl = c.redirectUrl || `/enroll/${examSlug}`
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    mode: c.mode,
    languages: strings(c.languages),
    faculty: strings(c.faculty),
    startDate: isoDate(c.startDate),
    liveClasses: c.liveClasses,
    recordedVideos: c.recordedVideos,
    totalTests: c.totalTests,
    stats: list<{ label: string; value: string | number }>(c.extraStats),
    includes: strings(c.includes),
    // images first, the demo video last: the card opens on a picture
    media: [...images, ...video],
    demoVideoUrl: c.demoVideoUrl,
    price: c.price,
    originalPrice: c.mrp,
    validity: validityLabel(c.validityMonths),
    offer: c.offerLabel,
    coupon: coupons.forCourse(c.id, c.price),
    isPrimary: c.isPrimary,
    enrollUrl,
    external: /^https?:\/\//.test(enrollUrl),
  }
}

const faq = (f: { question: string; answer: string }) => ({ question: f.question, answer: f.answer })

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

/** GET /public/exams: the exam directory, grouped by category. */
export async function getExamDirectory(db: Db) {
  const categories = await db.examCategory.findMany({
    where: { active: true },
    orderBy: { sort: 'asc' },
    include: {
      exams: {
        where: { status: { in: ['PUBLISHED', 'COMING_SOON'] } },
        orderBy: [{ menuSort: 'asc' }, { name: 'asc' }],
        select: {
          ...menuExamSelect,
          fullName: true,
          _count: { select: { papers: { where: { visible: true } } } },
        },
      },
    },
  })
  return {
    categories: categories
      .filter((c) => c.exams.length > 0)
      .map((c) => ({
        id: c.slug,
        label: c.label,
        icon: c.iconKey,
        exams: c.exams.map((e) => ({ ...menuExam(e), fullName: e.fullName, paperCount: e._count.papers })),
      })),
  }
}

type PaperRow = {
  id: string
  year: number
  stage: string | null
  shift: string | null
  type: string | null
  heldOn: Date | null
  questions: number | null
  marks: number | null
  durationMinutes: number | null
  languages: unknown
  viewUrl: string | null
  downloadUrl: string | null
  practiceUrl: string | null
  testId: string | null
}

/** One previous year paper in the shape of the frontend's lib/papers.js. One uploaded PDF serves both View and Download. */
const paper = (p: PaperRow) => ({
  id: p.id,
  year: p.year,
  stage: p.stage,
  shift: p.shift,
  type: p.type,
  heldOn: isoDate(p.heldOn),
  questions: p.questions,
  marks: p.marks,
  durationMinutes: p.durationMinutes,
  languages: strings(p.languages),
  viewUrl: p.viewUrl ?? p.downloadUrl,
  downloadUrl: p.downloadUrl ?? p.viewUrl,
  // until the test engine (Phase 3) gives `testId` an attempt route, "Attempt Online" uses the admin's link
  practiceUrl: p.practiceUrl,
  hasOnlineTest: Boolean(p.testId),
})

/** GET /public/exams/:slug: the full hub, in the shape of data/exams/sbiPo.js. Only PUBLISHED exams have a hub. */
export async function getExamHub(db: Db, slug: string) {
  const e = await db.exam.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      category: true,
      org: true,
      quickInfo: bySort,
      dates: bySort,
      updates: { orderBy: { date: 'desc' } },
      eligibilitySections: bySort,
      patternStages: { ...bySort, include: { sections: bySort } },
      syllabusStages: { ...bySort, include: { subjects: bySort } },
      papers: { where: { visible: true }, orderBy: [{ year: 'desc' }, { stage: 'asc' }] },
      resources: bySort,
      faqs: { where: { active: true }, ...bySort },
      series: publishedSeries,
      freeTests: { where: { status: 'PUBLISHED' }, ...bySort },
      courses: { where: { status: 'PUBLISHED' }, orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }] },
      faculty: { where: { visible: true }, ...bySort },
      relatedTo: {
        ...bySort,
        include: { related: { select: { ...menuExamSelect, fullName: true } } },
      },
    },
  })
  if (!e) return null
  const coupons = await loadCoupons(db)

  const links = new LinkResolver(db).add(...e.resources)
  await links.load()

  return {
    slug: e.slug,
    /** set = the frontend forwards /exams/<slug> (and its papers page) to this URL */
    redirectUrl: e.redirectUrl,
    name: e.name,
    fullName: e.fullName,
    category: e.category.label,
    categorySlug: e.category.slug,
    org: e.org.key,
    orgName: e.org.name,
    orgLogoUrl: e.org.logoUrl,
    description: e.description,
    status: e.statusLabel ? { label: e.statusLabel, tone: (e.statusTone ?? 'INFO').toLowerCase() } : null,
    quickInfo: e.quickInfo.map((q) => ({ label: q.label, value: q.value })),
    testSeries: e.series.map((s) => hubSeries(s, coupons)),
    courses: e.courses.map((c) => hubCourse(c, e.slug, coupons)),
    faculty: e.faculty.map((t) => ({ id: t.id, name: t.name, subject: t.subject, experience: t.experience, photo: t.photoUrl, demoVideoUrl: t.demoVideoUrl })),
    /** "Free Live Demo Class" strip; null = the first course's demo video */
    demoVideoUrl: e.demoVideoUrl,
    latestUpdates: e.updates.map((u) => ({
      date: isoDate(u.date),
      title: u.title,
      description: u.description,
      sourceUrl: u.sourceUrl,
      sourceLabel: u.sourceLabel,
    })),
    importantDates: e.dates.map((d) => ({ event: d.event, date: isoDate(d.date), highlight: d.highlight })),
    eligibility: {
      highlights: list<{ label: string; value: string }>(e.eligibilityHighlights),
      sections: e.eligibilitySections.map((s) => ({ title: s.title, blocks: list(s.blocks) })),
      disclaimer: e.eligibilityDisclaimer,
    },
    examPattern: {
      summary: e.patternSummary,
      stages: e.patternStages.map((st) => ({
        name: st.name,
        description: st.description,
        negativeMarking: st.negativeMarking,
        negativeMarkingShort: st.negativeMarkingShort,
        sections: st.sections.map((s) => ({
          name: s.name,
          questions: s.questions,
          marks: s.marks,
          durationMinutes: s.durationMinutes,
          negativeMarking: s.negativeMarking,
        })),
        notes: strings(st.notes),
      })),
      disclaimer: e.patternDisclaimer,
    },
    syllabus: {
      officialUrl: e.syllabusOfficialUrl,
      stages: e.syllabusStages.map((st) => ({ name: st.name, subjects: st.subjects.map((s) => ({ name: s.name, topics: strings(s.topics) })) })),
    },
    previousYearPapers: e.papers.map(paper),
    freeTests: e.freeTests.map((t) => hubFreeTest(t)),
    resources: e.resources.map((r) => ({ type: r.type, title: r.title, description: r.description, href: links.href(r) })),
    faqs: e.faqs.map(faq),
    relatedExams: e.relatedTo
      .filter((r) => r.related.status === 'PUBLISHED' || r.related.status === 'COMING_SOON')
      .map((r) => ({ ...menuExam(r.related), fullName: r.related.fullName })),
    seo: { title: e.seoTitle ?? e.name, description: e.seoDescription ?? e.description, ogImageUrl: e.ogImageUrl },
  }
}

// ---------------------------------------------------------------------------
// Academic classes
// ---------------------------------------------------------------------------

/** GET /public/classes/:slug: the class hub, in the shape of data/classes/class6.js. */
export async function getClassHub(db: Db, slug: string) {
  const c = await db.academicClass.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      group: true,
      quickInfo: bySort,
      subjects: bySort,
      steps: bySort,
      series: publishedSeries,
      freeTests: { where: { status: 'PUBLISHED' }, ...bySort },
      faqs: { where: { active: true }, ...bySort },
    },
  })
  if (!c) return null
  const coupons = await loadCoupons(db)

  const others = await db.academicClass.findMany({
    where: { id: { not: c.id }, status: { in: ['PUBLISHED', 'COMING_SOON'] } },
    orderBy: { grade: 'asc' },
    include: { group: { select: { label: true } } },
  })

  return {
    slug: c.slug,
    /** set = the frontend forwards /academic/<slug> to this URL */
    redirectUrl: c.redirectUrl,
    name: c.name,
    grade: c.grade,
    stage: c.group.label,
    category: 'Academic',
    boards: strings(c.boards),
    description: c.description,
    quickInfo: c.quickInfo.map((q) => ({ label: q.label, value: q.value })),
    testSeries: c.series.map((s) => hubSeries(s, coupons)),
    subjects: c.subjects.map((s) => ({ name: s.name, summary: s.summary, testTypes: strings(s.testTypes), topics: strings(s.topics) })),
    howItWorks: c.steps.map((s) => ({ title: s.title, text: s.text })),
    freeTests: c.freeTests.map((t) => hubFreeTest(t)),
    faqs: c.faqs.map(faq),
    relatedClasses: others.map((o) => ({
      slug: o.slug,
      name: o.name,
      stage: o.group.label,
      hasPage: o.status === 'PUBLISHED',
      href: classTarget(o),
    })),
    seo: { title: c.seoTitle ?? c.name, description: c.seoDescription ?? c.description, ogImageUrl: c.ogImageUrl },
  }
}

// ---------------------------------------------------------------------------
// Enroll page product
// ---------------------------------------------------------------------------

/**
 * GET /public/products/:slug: what an /enroll/:slug URL refers to, in the lookup order of the frontend's
 * lib/products.js: the pass -> a series slug -> an exam slug (its primary series) -> a class slug.
 */
export async function getProduct(db: Db, slug: string) {
  const pass = await db.pass.findFirst({ where: { slug, active: true } })
  if (pass) {
    return {
      type: 'PASS' as const,
      slug: pass.slug,
      title: pass.title,
      validity: validityLabel(pass.validityMonths),
      price: pass.price,
      originalPrice: pass.mrp,
      includes: strings(pass.benefits),
      /** set = /enroll/<slug> forwards here instead of showing our enroll page */
      redirectUrl: pageRedirect(pass),
    }
  }
  const series =
    (await db.testSeries.findFirst({ where: { slug, status: 'PUBLISHED' } })) ??
    (await db.testSeries.findFirst({ where: { status: 'PUBLISHED', exam: { is: { slug } } }, orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }] })) ??
    (await db.testSeries.findFirst({ where: { status: 'PUBLISHED', class: { is: { slug } } }, orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }] }))
  if (!series) return null
  return { type: 'SERIES' as const, ...hubSeries(series, await loadCoupons(db)), redirectUrl: pageRedirect(series) }
}

// ---------------------------------------------------------------------------
// CMS pages
// ---------------------------------------------------------------------------

/**
 * GET /public/pages/:slug. `body` is markdown; the frontend renders it with a markdown renderer that does not
 * allow raw HTML (e.g. react-markdown defaults), so admin-written content cannot inject scripts.
 */
export async function getPage(db: Db, slug: string) {
  const p = await db.page.findFirst({ where: { slug, status: 'PUBLISHED' } })
  if (!p) return null
  return {
    slug: p.slug,
    title: p.title,
    body: p.body,
    updatedAt: p.updatedAt.toISOString(),
    seo: { title: p.seoTitle ?? p.title, description: p.seoDescription },
  }
}
