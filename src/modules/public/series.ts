import type { Prisma } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/db.js'
import { discountPercent, strings, validityLabel } from '../../lib/format.js'
import { paths } from '../../lib/links.js'

export const cardInclude = {
  exam: {
    select: {
      slug: true,
      name: true,
      status: true,
      org: { select: { key: true } },
      freeTests: { where: { status: 'PUBLISHED' }, select: { slug: true } },
    },
  },
} satisfies Prisma.TestSeriesInclude

type CardRow = Prisma.TestSeriesGetPayload<{ include: typeof cardInclude }>

/**
 * Home / explorer card, in the shape the frontend's CourseCard reads today (data/testSeries.js),
 * plus hrefs and counts the card used to compute from other static files.
 */
export function seriesCard(s: CardRow) {
  const features = [
    { icon: 'ClipboardCheck', value: s.fullLengthTests, label: 'Full-length Mocks' },
    { icon: 'LayoutList', value: s.sectionalTests, label: 'Sectional Tests' },
    { icon: 'ListChecks', value: s.topicTests, label: 'Topic-wise Tests' },
    { icon: 'History', value: s.pyqTests, label: 'Previous Year Papers' },
  ].filter((f) => f.value > 0)
  return {
    slug: s.slug,
    exam: s.exam?.name ?? s.title,
    examSlug: s.exam?.slug ?? null,
    examHref: s.exam?.status === 'PUBLISHED' ? paths.exam(s.exam.slug) : null,
    org: s.exam?.org.key ?? null,
    title: s.title,
    subtitle: s.subtitle,
    language: strings(s.languages).join(' · ') || null,
    languages: strings(s.languages),
    tag: s.stageTag,
    validity: validityLabel(s.validityMonths),
    validityMonths: s.validityMonths,
    price: s.price,
    mrp: s.mrp,
    discountPercent: discountPercent(s.price, s.mrp),
    offer: s.offerLabel,
    image: s.posterUrl,
    totalTests: s.totalTests || features.reduce((n, f) => n + f.value, 0),
    features,
    freeTests: s.exam?.freeTests.length ?? 0,
    href: paths.enroll(s.slug),
  }
}

/**
 * The hero explorer lists one card per exam: each published primary series whose exam is not archived.
 * The series' own status decides visibility, so a series can be sold before its exam has a hub or menu entry
 * (RBI Assistant today). Extra series of a hub ("SBI PO Mains") show on the hub page, not in the explorer.
 */
const explorerWhere = (examCategoryIds?: string[]): Prisma.TestSeriesWhereInput => ({
  status: 'PUBLISHED',
  isPrimary: true,
  exam: {
    is: {
      status: { not: 'ARCHIVED' },
      ...(examCategoryIds ? { categoryId: { in: examCategoryIds } } : {}),
    },
  },
})

export interface SeriesQuery {
  /** HeroCategory key ("banking"); omitted = all categories */
  category?: string | undefined
  /** SeriesTab key ("popular"); omitted = first visible tab */
  tab?: string | undefined
  limit?: number | undefined
}

/** GET /public/series: cards for a hero chip + tab, applying the tab's rule on the server. */
export async function getSeriesCards(db: Db, q: SeriesQuery) {
  const tab = q.tab
    ? await db.seriesTab.findUnique({ where: { key: q.tab }, include: { items: { orderBy: { sort: 'asc' } } } })
    : await db.seriesTab.findFirst({ where: { visible: true }, orderBy: { sort: 'asc' }, include: { items: { orderBy: { sort: 'asc' } } } })
  if (!tab || !tab.visible) return null

  let categoryIds: string[] | undefined
  let category: { id: string; label: string } | null = null
  if (q.category) {
    const hero = await db.heroCategory.findUnique({ where: { key: q.category }, include: { categories: true } })
    if (!hero || !hero.visible) return null
    category = { id: hero.key, label: hero.label }
    categoryIds = hero.categories.map((c) => c.examCategoryId)
  }

  const items =
    categoryIds && categoryIds.length === 0
      ? [] // a chip with no categories: "no test series yet"
      : await db.testSeries.findMany({
          where: { AND: [explorerWhere(categoryIds), ruleWhere(tab.rule)] },
          orderBy: [{ sort: 'asc' }, { title: 'asc' }],
          include: cardInclude,
        })

  let ordered = items
  if (tab.rule === 'CURATED') {
    // curated picks first, in the admin's order; the rest follow so a category never looks empty
    const rank = new Map(tab.items.map((it, i) => [it.seriesId, i]))
    ordered = [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
  }

  const limit = Math.min(...[tab.limit, q.limit].filter((n): n is number => typeof n === 'number' && n > 0), Infinity)
  return {
    tab: { id: tab.key, label: tab.label, heading: tab.heading },
    category,
    items: ordered.slice(0, Number.isFinite(limit) ? limit : undefined).map(seriesCard),
  }
}

function ruleWhere(rule: string): Prisma.TestSeriesWhereInput {
  switch (rule) {
    case 'HAS_SECTIONAL':
      return { sectionalTests: { gt: 0 } }
    case 'HAS_TOPIC':
      return { topicTests: { gt: 0 } }
    case 'HAS_PYQ':
      return { pyqTests: { gt: 0 } }
    case 'HAS_FREE_TEST':
      return { exam: { is: { freeTests: { some: { status: 'PUBLISHED' } } } } }
    default:
      return {}
  }
}

/** Series tabs + hero chips (for the hero header). */
export async function getExplorerMeta(db: Db) {
  const [tabs, chips] = await Promise.all([
    db.seriesTab.findMany({ where: { visible: true }, orderBy: { sort: 'asc' } }),
    db.heroCategory.findMany({ where: { visible: true }, orderBy: { sort: 'asc' }, include: { categories: { include: { examCategory: { select: { slug: true } } } } } }),
  ])
  return {
    tabs: tabs.map((t) => ({ id: t.key, label: t.label, icon: t.iconKey, heading: t.heading, limit: t.limit })),
    categories: chips.map((c) => ({ id: c.key, label: c.label, icon: c.iconKey, categorySlugs: c.categories.map((l) => l.examCategory.slug) })),
  }
}
