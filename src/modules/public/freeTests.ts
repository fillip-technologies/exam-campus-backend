import type { Prisma } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/db.js'
import { strings } from '../../lib/format.js'
import { freeTestTarget, pageRedirect } from '../../lib/links.js'

const include = {
  exam: { select: { slug: true, name: true, org: { select: { key: true } }, category: { select: { slug: true, label: true, shortLabel: true } } } },
  class: { select: { slug: true, name: true } },
} satisfies Prisma.FreeTestInclude

type Row = Prisma.FreeTestGetPayload<{ include: typeof include }>

/** Free test card: the shape of data/freeTests.js (exam, org, category, questions, minutes, slug) + hub fields. */
export const freeTestCard = (t: Row) => ({
  slug: t.slug,
  title: t.title,
  exam: t.exam?.name ?? t.class?.name ?? t.title,
  org: t.exam?.org.key ?? null,
  category: t.exam ? (t.exam.category.shortLabel ?? t.exam.category.label) : null,
  categorySlug: t.exam?.category.slug ?? null,
  questions: t.questions,
  minutes: t.durationMinutes,
  durationMinutes: t.durationMinutes,
  type: t.testKindLabel,
  highlights: strings(t.highlights),
  featured: t.featured,
  available: Boolean(t.testId), // false until the test engine (Phase 3) has the real test
  href: freeTestTarget(t),
  /** /free-test/:slug forwards here instead of showing our start page */
  redirectUrl: pageRedirect(t),
})

/** GET /public/free-tests?category=: exam free tests (the home list), optionally for one category. */
export async function getFreeTests(db: Db, category?: string) {
  const [filters, tests] = await Promise.all([
    db.examCategory.findMany({ where: { active: true, showInFreeTestFilter: true }, orderBy: { sort: 'asc' } }),
    db.freeTest.findMany({
      where: {
        status: 'PUBLISHED',
        examId: { not: null },
        ...(category ? { exam: { is: { category: { slug: category } } } } : {}),
      },
      orderBy: [{ featured: 'desc' }, { sort: 'asc' }],
      include,
    }),
  ])
  return {
    filters: filters.map((c) => ({ id: c.slug, label: c.shortLabel ?? c.label })),
    items: tests.map((t) => freeTestCard(t)),
  }
}

/** GET /public/free-tests/:slug: same lookup order as the frontend's getFreeTestBySlug (free test -> exam -> class). */
export async function getFreeTestBySlug(db: Db, slug: string) {
  const published = { status: 'PUBLISHED' as const }
  const freeTestCard_ = (t: Row) => freeTestCard(t)
  const direct = await db.freeTest.findFirst({ where: { slug, ...published }, include })
  if (direct) return freeTestCard_(direct)
  const viaExam = await db.freeTest.findFirst({ where: { ...published, exam: { is: { slug } } }, orderBy: { sort: 'asc' }, include })
  if (viaExam) return freeTestCard_(viaExam)
  const viaClass = await db.freeTest.findFirst({ where: { ...published, class: { is: { slug } } }, orderBy: { sort: 'asc' }, include })
  return viaClass ? freeTestCard_(viaClass) : null
}
