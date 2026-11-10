import { z } from 'zod'
import { eligibilityBlocks, faqOwner, hubOwner, labelValueList, navLinkOwner, slugify } from '../../shared/schemas.js'
import type { Resource, Tx } from './crud.js'
import { checkLink, f, linkFields } from './fields.js'
import { homeSectionConfigIssues } from './homeConfig.js'

type Issue = { path: string; message: string }
type RowData = Record<string, unknown>

// ---------------------------------------------------------------------------
// shared rules
// ---------------------------------------------------------------------------

const zodIssues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, fallback: string): Issue[] =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => ({ path: i.path.map(String).join('.') || fallback, message: i.message }))

const linkTargetModel: Record<string, string> = {
  EXAM: 'exam',
  CLASS: 'academicClass',
  SERIES: 'testSeries',
  FREE_TEST: 'freeTest',
  CATEGORY: 'examCategory',
  PAGE: 'page',
}

/** Link triple shape + the referenced row exists (linkRef = target id). */
async function linkIssues(tx: Tx, row: RowData, prefix = ''): Promise<Issue[]> {
  const issues = checkLink(row, prefix)
  if (issues.length) return issues
  const key = (k: string) => (prefix ? `${prefix}${k[0]!.toUpperCase()}${k.slice(1)}` : k)
  const model = linkTargetModel[String(row[key('linkType')] ?? 'NONE')]
  const ref = row[key('linkRef')]
  if (!model || typeof ref !== 'string') return []
  const found = await (tx as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[model]!.count({ where: { id: ref } })
  return found ? [] : [{ path: key('linkRef'), message: 'The linked item does not exist (pick it again)' }]
}

const links =
  (...prefixes: string[]) =>
  async (row: RowData, { tx }: { tx: Tx }) =>
    (await Promise.all((prefixes.length ? prefixes : ['']).map((p) => linkIssues(tx, row, p)))).flat()

const all =
  (...rules: ((row: RowData, ctx: { tx: Tx; existing: RowData | null }) => Issue[] | Promise<Issue[]>)[]) =>
  async (row: RowData, ctx: { tx: Tx; existing: RowData | null }) =>
    (await Promise.all(rules.map((r) => r(row, ctx)))).flat()

const hubOwnerRule = (row: RowData) => zodIssues(hubOwner.safeParse(row), 'examId')

/** Renaming a slug keeps the old URL working: SlugRedirect old -> new (and re-points older redirects). */
const slugRedirect = (entityType: string) => async (tx: Tx, row: RowData, _input: RowData, existing: RowData | null) => {
  if (!existing || existing.slug === row.slug) return
  const oldSlug = String(existing.slug)
  const newSlug = String(row.slug)
  await tx.slugRedirect.deleteMany({ where: { entityType, oldSlug: newSlug } }) // the new slug is live again
  await tx.slugRedirect.updateMany({ where: { entityType, newSlug: oldSlug }, data: { newSlug } })
  await tx.slugRedirect.upsert({
    where: { entityType_oldSlug: { entityType, oldSlug } },
    create: { entityType, oldSlug, newSlug },
    update: { newSlug },
  })
}

const stringArray = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [])

// ---------------------------------------------------------------------------
// resources
// ---------------------------------------------------------------------------

const visible = { visible: f.bool(), sort: f.sort() }

export const resources: Resource[] = [
  // ===== Site chrome ========================================================
  {
    path: 'announcements',
    model: 'announcement',
    entityType: 'announcement',
    sortable: true,
    search: ['text'],
    fields: z.object({
      text: f.str(500),
      mobileText: f.optStr(),
      ctaLabel: f.optStr(),
      ...linkFields(),
      theme: z.enum(['dark', 'accent', 'light']).nullable().optional(),
      dismissible: f.bool(),
      startsAt: f.optDateTime(),
      endsAt: f.optDateTime(),
      active: f.bool(),
      sort: f.sort(),
      customFields: f.json(),
    }),
    rules: links(),
  },
  {
    path: 'nav-items',
    model: 'navItem',
    entityType: 'navItem',
    sortable: true,
    search: ['label', 'key'],
    include: { columns: { orderBy: { sort: 'asc' }, include: { links: { orderBy: { sort: 'asc' } } } }, links: { orderBy: { sort: 'asc' } } },
    fields: z.object({
      key: f.slug(),
      label: f.str(),
      ariaLabel: f.optStr(),
      type: z.enum(['MEGA', 'DROPDOWN', 'LINK']),
      badge: f.optStr(),
      iconKey: f.icon(),
      wide: f.bool(),
      footerLabel: f.optStr(),
      ...linkFields('footer'),
      ...linkFields(),
      contentSource: z.enum(['MANUAL', 'EXAM_CATEGORIES']).optional(),
      categoryMenu: z.enum(['COMPETITIVE', 'PYQ']).nullable().optional(),
      activePathPrefix: f.optStr(),
      ...visible,
      customFields: f.json(),
    }),
    rules: all(links('', 'footer'), (row) =>
      row.contentSource === 'EXAM_CATEGORIES' && !row.categoryMenu ? [{ path: 'categoryMenu', message: 'Pick which category menu to show' }] : [],
    ),
  },
  {
    path: 'nav-columns',
    model: 'navColumn',
    entityType: 'navColumn',
    sortable: true,
    filters: { navItemId: f.id().optional() },
    include: { links: { orderBy: { sort: 'asc' } } },
    fields: z.object({ navItemId: f.id(), title: f.str(), description: f.optStr(), iconKey: f.icon(), ...visible }),
  },
  {
    path: 'nav-links',
    model: 'navLink',
    entityType: 'navLink',
    sortable: true,
    filters: { navItemId: f.id().optional(), columnId: f.id().optional() },
    fields: z.object({
      navItemId: f.optId(),
      columnId: f.optId(),
      label: f.str(),
      description: f.optStr(),
      iconKey: f.icon(),
      ...linkFields(),
      ...visible,
      customFields: f.json(),
    }),
    rules: all((row) => zodIssues(navLinkOwner.safeParse(row), 'navItemId'), links()),
  },
  {
    path: 'footer-columns',
    model: 'footerColumn',
    entityType: 'footerColumn',
    sortable: true,
    include: { links: { orderBy: { sort: 'asc' } } },
    fields: z.object({ title: f.str(), ...visible }),
  },
  {
    path: 'footer-links',
    model: 'footerLink',
    entityType: 'footerLink',
    sortable: true,
    filters: { columnId: f.id().optional(), legal: z.coerce.boolean().optional() },
    fields: z.object({ columnId: f.optId(), legal: f.bool(), label: f.str(), ...linkFields(), ...visible }),
    rules: all(
      (row) =>
        row.legal ? (row.columnId ? [{ path: 'columnId', message: 'Legal links sit in the bottom bar, not in a column' }] : []) : row.columnId ? [] : [{ path: 'columnId', message: 'Pick a footer column' }],
      links(),
    ),
  },
  {
    path: 'social-links',
    model: 'socialLink',
    entityType: 'socialLink',
    sortable: true,
    fields: z.object({ platform: f.str(), url: z.string().trim().min(1).max(2048), ...visible }),
  },
  {
    path: 'search-suggestions',
    model: 'searchSuggestion',
    entityType: 'searchSuggestion',
    sortable: true,
    filters: { kind: z.enum(['SUGGESTION', 'POPULAR']).optional() },
    fields: z.object({ kind: z.enum(['SUGGESTION', 'POPULAR']), label: f.str(), sort: f.sort() }),
  },

  // ===== Home page ==========================================================
  {
    path: 'home-sections',
    model: 'homeSection',
    entityType: 'homeSection',
    sortable: true,
    search: ['title', 'key'],
    include: { items: { orderBy: { sort: 'asc' } } },
    fields: z.object({
      key: f.slug(),
      type: z.enum(['HERO', 'WHY_POINTS', 'EXAM_CATEGORIES', 'PASS', 'FREE_TESTS', 'EXAM_EXPERIENCE', 'MOBILE_APP', 'FAQ', 'FINAL_CTA', 'RICH_TEXT', 'BANNER_STRIP', 'CUSTOM_BLOCK', 'COLLECTION']),
      anchorId: f.optStr(),
      eyebrow: f.optStr(),
      title: f.optStr(500),
      subtitle: f.optText(),
      body: f.optText(),
      config: z.record(z.string(), z.unknown()).nullable().optional(),
      blockTypeKey: f.optStr(),
      collectionKey: f.optStr(),
      publishAt: f.optDateTime(),
      unpublishAt: f.optDateTime(),
      ...visible,
      customFields: f.json(),
    }),
    onCreate: (input) => ({ config: input.config ?? {} }),
    rules: (row) => homeSectionConfigIssues(String(row.type), row.config),
  },
  {
    path: 'section-items',
    model: 'sectionItem',
    entityType: 'sectionItem',
    sortable: true,
    filters: { sectionId: f.id().optional() },
    fields: z.object({
      sectionId: f.id(),
      role: z.enum(['ITEM', 'CTA_PRIMARY', 'CTA_SECONDARY']).optional(),
      iconKey: f.icon(),
      title: f.optStr(500),
      text: f.optText(),
      ...linkFields(),
      ...visible,
      customFields: f.json(),
    }),
    rules: links(),
  },
  {
    path: 'banners',
    model: 'banner',
    entityType: 'banner',
    sortable: true,
    search: ['alt'],
    filters: { placement: z.enum(['HERO', 'STRIP']).optional() },
    fields: z.object({
      placement: z.enum(['HERO', 'STRIP']).optional(),
      imageUrl: f.url(),
      mobileImageUrl: f.optUrl(),
      alt: f.str(500),
      ...linkFields(),
      startsAt: f.optDateTime(),
      endsAt: f.optDateTime(),
      active: f.bool(),
      sort: f.sort(),
      customFields: f.json(),
    }),
    rules: links(),
  },
  {
    path: 'hero-categories',
    model: 'heroCategory',
    entityType: 'heroCategory',
    sortable: true,
    include: { categories: true },
    relationKeys: ['examCategoryIds'],
    fields: z.object({ key: f.slug(), label: f.str(), iconKey: f.icon(), ...visible, examCategoryIds: z.array(f.id()).max(50).optional() }),
    present: (row) => {
      const { categories, ...rest } = row as RowData & { categories?: { examCategoryId: string }[] }
      return { ...rest, examCategoryIds: (categories ?? []).map((c) => c.examCategoryId) }
    },
    afterWrite: async (tx, row, input) => {
      if (!input.examCategoryIds) return
      await tx.heroCategoryLink.deleteMany({ where: { heroCategoryId: row.id } })
      await tx.heroCategoryLink.createMany({ data: stringArray(input.examCategoryIds).map((examCategoryId) => ({ heroCategoryId: row.id, examCategoryId })) })
    },
  },
  {
    path: 'series-tabs',
    model: 'seriesTab',
    entityType: 'seriesTab',
    sortable: true,
    include: { items: { orderBy: { sort: 'asc' } } },
    relationKeys: ['seriesIds'],
    fields: z.object({
      key: f.slug(),
      label: f.str(),
      iconKey: f.icon(),
      heading: f.str(),
      limit: f.optInt(1, 100),
      rule: z.enum(['CURATED', 'ALL', 'HAS_SECTIONAL', 'HAS_TOPIC', 'HAS_PYQ', 'HAS_FREE_TEST']).optional(),
      ...visible,
      /** CURATED tabs: series in the order to show first */
      seriesIds: z.array(f.id()).max(100).optional(),
    }),
    present: (row) => {
      const { items, ...rest } = row as RowData & { items?: { seriesId: string }[] }
      return { ...rest, seriesIds: (items ?? []).map((i) => i.seriesId) }
    },
    afterWrite: async (tx, row, input) => {
      if (!input.seriesIds) return
      await tx.seriesTabItem.deleteMany({ where: { tabId: row.id } })
      await tx.seriesTabItem.createMany({ data: stringArray(input.seriesIds).map((seriesId, sort) => ({ tabId: row.id, seriesId, sort })) })
    },
  },

  // ===== Catalog ============================================================
  {
    path: 'exam-categories',
    model: 'examCategory',
    entityType: 'examCategory',
    sortable: true,
    search: ['label', 'slug'],
    fields: z.object({
      slug: f.slug(),
      label: f.str(),
      shortLabel: f.optStr(),
      iconKey: f.icon(),
      sort: f.sort(),
      active: f.bool(),
      showInCompetitiveMenu: f.bool(),
      showInPyqMenu: f.bool(),
      showInHomeGrid: f.bool(),
      showInFreeTestFilter: f.bool(),
      customFields: f.json(),
    }),
  },
  {
    path: 'organizations',
    model: 'examOrganization',
    entityType: 'examOrganization',
    search: ['name', 'key'],
    orderBy: [{ key: 'asc' }],
    fields: z.object({ key: f.slug(), name: f.str(), logoUrl: f.optUrl(), customFields: f.json() }),
  },
  {
    path: 'class-groups',
    model: 'classGroup',
    entityType: 'classGroup',
    sortable: true,
    fields: z.object({ slug: f.slug(), label: f.str(), iconKey: f.icon(), tagline: f.optStr(), sort: f.sort(), customFields: f.json() }),
  },
  {
    path: 'exams',
    model: 'exam',
    entityType: 'exam',
    publishable: true,
    stampsPublishedAt: true,
    search: ['name', 'slug', 'fullName'],
    filters: { status: f.status(), categoryId: f.id().optional(), orgId: f.id().optional() },
    orderBy: [{ category: { sort: 'asc' } }, { menuSort: 'asc' }, { name: 'asc' }],
    listInclude: { category: { select: { label: true } }, org: { select: { key: true } }, _count: { select: { series: true, freeTests: true } } },
    include: { relatedTo: { orderBy: { sort: 'asc' } } },
    relationKeys: ['relatedExamIds'],
    fields: z.object({
      slug: f.slug(),
      name: f.str(),
      fullName: f.optStr(500),
      categoryId: f.id(),
      orgId: f.id(),
      description: f.optText(),
      statusLabel: f.optStr(),
      statusTone: z.enum(['INFO', 'SUCCESS', 'WARNING']).nullable().optional(),
      status: f.status(),
      menuSort: f.sort(),
      aliases: f.stringList(),
      seoTitle: f.optStr(),
      seoDescription: f.optStr(500),
      ogImageUrl: f.optUrl(),
      eligibilityHighlights: labelValueList.nullable().optional(),
      eligibilityDisclaimer: f.optText(),
      patternSummary: f.optText(),
      patternDisclaimer: f.optText(),
      syllabusOfficialUrl: f.optUrl(),
      relatedExamIds: z.array(f.id()).max(30).optional(),
      customFields: f.json(),
    }),
    present: (row) => {
      const { relatedTo, ...rest } = row as RowData & { relatedTo?: { relatedExamId: string }[] }
      return relatedTo ? { ...rest, relatedExamIds: relatedTo.map((r) => r.relatedExamId) } : rest
    },
    afterWrite: async (tx, row, input, existing) => {
      await slugRedirect('exam')(tx, row, input, existing)
      if (!input.relatedExamIds) return
      const ids = stringArray(input.relatedExamIds).filter((id) => id !== row.id)
      await tx.examRelation.deleteMany({ where: { examId: row.id } })
      await tx.examRelation.createMany({ data: ids.map((relatedExamId, sort) => ({ examId: row.id, relatedExamId, sort })) })
    },
  },
  {
    path: 'quick-info',
    model: 'quickInfoItem',
    entityType: 'quickInfoItem',
    sortable: true,
    filters: { examId: f.id().optional(), classId: f.id().optional() },
    fields: z.object({ examId: f.optId(), classId: f.optId(), label: f.str(), value: f.optStr(500), sort: f.sort() }),
    rules: hubOwnerRule,
  },
  {
    path: 'exam-dates',
    model: 'examDate',
    entityType: 'examDate',
    sortable: true,
    filters: { examId: f.id().optional() },
    fields: z.object({ examId: f.id(), event: f.str(), date: f.optDate(), highlight: f.bool(), sort: f.sort() }),
  },
  {
    path: 'exam-updates',
    model: 'examUpdate',
    entityType: 'examUpdate',
    filters: { examId: f.id().optional() },
    orderBy: [{ date: 'desc' }],
    fields: z.object({ examId: f.id(), date: f.date(), title: f.str(500), description: f.optText(), sourceUrl: f.optUrl(), sourceLabel: f.optStr() }),
  },
  {
    path: 'eligibility-sections',
    model: 'examEligibilitySection',
    entityType: 'examEligibilitySection',
    sortable: true,
    filters: { examId: f.id().optional() },
    fields: z.object({ examId: f.id(), title: f.str(), blocks: eligibilityBlocks, sort: f.sort() }),
  },
  {
    path: 'pattern-stages',
    model: 'examPatternStage',
    entityType: 'examPatternStage',
    sortable: true,
    filters: { examId: f.id().optional() },
    include: { sections: { orderBy: { sort: 'asc' } } },
    fields: z.object({
      examId: f.id(),
      name: f.str(500),
      description: f.optText(),
      negativeMarking: f.optStr(500),
      negativeMarkingShort: f.optStr(),
      notes: f.stringList(),
      sort: f.sort(),
    }),
  },
  {
    path: 'pattern-sections',
    model: 'examPatternSection',
    entityType: 'examPatternSection',
    sortable: true,
    filters: { stageId: f.id().optional() },
    fields: z.object({
      stageId: f.id(),
      name: f.str(),
      questions: f.optInt(),
      marks: f.optInt(),
      durationMinutes: f.optInt(),
      negativeMarking: f.optStr(),
      sort: f.sort(),
    }),
  },
  {
    path: 'syllabus-stages',
    model: 'examSyllabusStage',
    entityType: 'examSyllabusStage',
    sortable: true,
    filters: { examId: f.id().optional() },
    include: { subjects: { orderBy: { sort: 'asc' } } },
    fields: z.object({ examId: f.id(), name: f.str(), sort: f.sort() }),
  },
  {
    path: 'syllabus-subjects',
    model: 'examSyllabusSubject',
    entityType: 'examSyllabusSubject',
    sortable: true,
    filters: { stageId: f.id().optional() },
    fields: z.object({ stageId: f.id(), name: f.str(), topics: f.stringList(), sort: f.sort() }),
  },
  {
    path: 'papers',
    model: 'previousYearPaper',
    entityType: 'previousYearPaper',
    filters: { examId: f.id().optional() },
    orderBy: [{ year: 'desc' }],
    fields: z.object({
      examId: f.id(),
      year: f.int(1950, 2100),
      stage: f.optStr(),
      shift: f.optStr(),
      type: f.optStr(),
      viewUrl: f.optUrl(),
      downloadUrl: f.optUrl(),
      testId: f.optId(),
      visible: f.bool(),
      customFields: f.json(),
    }),
  },
  {
    path: 'exam-resources',
    model: 'examResource',
    entityType: 'examResource',
    sortable: true,
    filters: { examId: f.id().optional() },
    fields: z.object({ examId: f.id(), type: f.str(), title: f.str(500), description: f.optText(), ...linkFields(), sort: f.sort(), customFields: f.json() }),
    rules: links(),
  },
  {
    path: 'faqs',
    model: 'faq',
    entityType: 'faq',
    sortable: true,
    search: ['question'],
    filters: { scope: z.enum(['HOME', 'EXAM', 'CLASS']).optional(), examId: f.id().optional(), classId: f.id().optional() },
    fields: z.object({
      scope: z.enum(['HOME', 'EXAM', 'CLASS']),
      examId: f.optId(),
      classId: f.optId(),
      question: f.str(500),
      answer: f.text(),
      sort: f.sort(),
      active: f.bool(),
    }),
    rules: (row) => zodIssues(faqOwner.safeParse(row), 'scope'),
  },
  {
    path: 'classes',
    model: 'academicClass',
    entityType: 'class',
    publishable: true,
    stampsPublishedAt: true,
    search: ['name', 'slug'],
    filters: { status: f.status(), groupId: f.id().optional() },
    orderBy: [{ grade: 'asc' }],
    listInclude: { group: { select: { label: true } } },
    fields: z.object({
      slug: f.slug(),
      name: f.str(),
      grade: f.int(1, 12),
      groupId: f.id(),
      boards: f.stringList(),
      description: f.optText(),
      status: f.status(),
      seoTitle: f.optStr(),
      seoDescription: f.optStr(500),
      ogImageUrl: f.optUrl(),
      customFields: f.json(),
    }),
    afterWrite: slugRedirect('class'),
  },
  {
    path: 'class-subjects',
    model: 'classSubject',
    entityType: 'classSubject',
    sortable: true,
    filters: { classId: f.id().optional() },
    fields: z.object({ classId: f.id(), name: f.str(), summary: f.optText(), testTypes: f.stringList(), topics: f.stringList(), sort: f.sort() }),
  },
  {
    path: 'how-it-works',
    model: 'howItWorksStep',
    entityType: 'howItWorksStep',
    sortable: true,
    filters: { classId: f.id().optional() },
    fields: z.object({ classId: f.id(), title: f.str(500), text: f.text(), sort: f.sort() }),
  },
  {
    path: 'series',
    model: 'testSeries',
    entityType: 'series',
    publishable: true,
    sortable: true,
    search: ['title', 'slug'],
    filters: { status: f.status(), examId: f.id().optional(), classId: f.id().optional() },
    listInclude: { exam: { select: { name: true } }, class: { select: { name: true } } },
    fields: z.object({
      slug: f.slug(),
      examId: f.optId(),
      classId: f.optId(),
      title: f.str(500),
      subtitle: f.optStr(500),
      stageTag: f.optStr(),
      languages: f.stringList(),
      validityMonths: f.int(1, 120),
      price: f.int(0, 1_000_000),
      mrp: f.int(0, 1_000_000),
      offerLabel: f.optStr(),
      posterUrl: f.optUrl(),
      includes: f.stringList(),
      extraStats: labelValueList.nullable().optional(),
      totalTests: f.int().optional(),
      fullLengthTests: f.int().optional(),
      sectionalTests: f.int().optional(),
      topicTests: f.int().optional(),
      pyqTests: f.int().optional(),
      isPrimary: f.bool(),
      status: f.status(),
      sort: f.sort(),
      customFields: f.json(),
    }),
    rules: all(hubOwnerRule, (row) => (Number(row.price) > Number(row.mrp) ? [{ path: 'price', message: 'Price cannot be more than the MRP' }] : [])),
    afterWrite: async (tx, row, input, existing) => {
      await slugRedirect('series')(tx, row, input, existing)
      // one primary series per hub: making this one primary clears the others
      if (row.isPrimary) {
        await tx.testSeries.updateMany({
          where: { id: { not: row.id }, isPrimary: true, ...(row.examId ? { examId: String(row.examId) } : { classId: String(row.classId) }) },
          data: { isPrimary: false },
        })
      }
    },
  },
  {
    path: 'free-tests',
    model: 'freeTest',
    entityType: 'freeTest',
    publishable: true,
    sortable: true,
    search: ['title', 'slug'],
    filters: { status: f.status(), examId: f.id().optional(), classId: f.id().optional() },
    listInclude: { exam: { select: { name: true } }, class: { select: { name: true } } },
    fields: z.object({
      slug: f.slug(),
      examId: f.optId(),
      classId: f.optId(),
      title: f.str(500),
      questions: f.int(1, 1000),
      durationMinutes: f.int(1, 1000),
      testKindLabel: f.optStr(),
      highlights: f.stringList(),
      featured: f.bool(),
      testId: f.optId(),
      status: f.status(),
      sort: f.sort(),
      customFields: f.json(),
    }),
    rules: hubOwnerRule,
  },
  {
    path: 'passes',
    model: 'pass',
    entityType: 'pass',
    write: 'ADMIN',
    fields: z.object({
      slug: f.slug(),
      title: f.str(),
      validityMonths: f.int(1, 120),
      price: f.int(0, 1_000_000),
      mrp: f.int(0, 1_000_000),
      benefits: f.stringList(),
      active: f.bool(),
      customFields: f.json(),
    }),
    rules: (row) => (Number(row.price) > Number(row.mrp) ? [{ path: 'price', message: 'Price cannot be more than the MRP' }] : []),
  },

  // ===== Content ============================================================
  {
    path: 'pages',
    model: 'page',
    entityType: 'page',
    publishable: true,
    search: ['title', 'slug'],
    filters: { status: f.status() },
    orderBy: [{ title: 'asc' }],
    fields: z.object({
      slug: f.slug(),
      title: f.str(500),
      body: z.string().max(1_000_000),
      status: f.status(),
      seoTitle: f.optStr(),
      seoDescription: f.optStr(500),
      customFields: f.json(),
    }),
    afterWrite: slugRedirect('page'),
  },

  // ===== Visitors (support staff) ===========================================
  {
    path: 'contact-messages',
    model: 'contactMessage',
    entityType: 'contactMessage',
    write: 'SUPPORT',
    search: ['name', 'email', 'mobile', 'subject'],
    filters: { status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']).optional() },
    orderBy: [{ createdAt: 'desc' }],
    // staff only change the status; the message itself comes from the visitor
    fields: z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']) }),
  },
]

/** Slug suggestion for admin forms ("SBI PO" -> "sbi-po"). */
export const suggestSlug = slugify
