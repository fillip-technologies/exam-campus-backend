/**
 * Zod schemas for API input and JSON-column validation. The frontend repo keeps its own copy of the
 * schemas its admin forms need (or installs them from a published package later): the two repos never import each other.
 * Phase 0 holds the building blocks; per-entity input schemas are added module by module in Phase 1.
 */
import { z } from 'zod'

export const publishStatus = z.enum(['DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED'])
export type PublishStatus = z.infer<typeof publishStatus>

export const role = z.enum(['STUDENT', 'SUPPORT', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'])
export type Role = z.infer<typeof role>

export const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes (e.g. "sbi-po")')

/** "SBI PO" -> "sbi-po". Same rule as the frontend's lib/slugify.js. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// ---------------------------------------------------------------------------
// Link triple (linkType + linkRef + linkUrl)
//   linkRef holds the target row's **id** for entity links, so renaming a slug never breaks a link.
//   ANCHOR keeps the DOM id in linkRef ("free-tests"); URL uses linkUrl ("https://..." or "/about").
// ---------------------------------------------------------------------------

export const linkType = z.enum(['NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR'])
export type LinkType = z.infer<typeof linkType>

export const link = z
  .object({
    linkType: linkType,
    linkRef: z.string().min(1).nullish(),
    linkUrl: z.string().min(1).max(2048).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.linkType === 'URL' && !v.linkUrl) ctx.addIssue({ code: 'custom', path: ['linkUrl'], message: 'URL links need a linkUrl' })
    if (v.linkType !== 'NONE' && v.linkType !== 'URL' && !v.linkRef)
      ctx.addIssue({ code: 'custom', path: ['linkRef'], message: `${v.linkType} links need a linkRef` })
  })
export type Link = z.infer<typeof link>

// ---------------------------------------------------------------------------
// "Exactly one owner" rules. MySQL cannot CHECK these columns because their foreign keys cascade,
// so every write goes through these refinements (API + admin forms).
// ---------------------------------------------------------------------------

/** TestSeries, FreeTest, QuickInfoItem: exactly one of examId / classId. */
export const hubOwner = z
  .object({ examId: z.string().nullish(), classId: z.string().nullish() })
  .refine((v) => Boolean(v.examId) !== Boolean(v.classId), { message: 'Set exactly one of examId or classId' })

/** Faq: HOME has no owner, EXAM needs examId, CLASS needs classId. */
export const faqOwner = z
  .object({ scope: z.enum(['HOME', 'EXAM', 'CLASS']), examId: z.string().nullish(), classId: z.string().nullish() })
  .refine(
    (v) =>
      (v.scope === 'HOME' && !v.examId && !v.classId) ||
      (v.scope === 'EXAM' && !!v.examId && !v.classId) ||
      (v.scope === 'CLASS' && !v.examId && !!v.classId),
    { message: 'Owner does not match the FAQ scope' },
  )

/** NavLink: exactly one of navItemId (dropdown link) / columnId (mega-menu column link). */
export const navLinkOwner = z
  .object({ navItemId: z.string().nullish(), columnId: z.string().nullish() })
  .refine((v) => Boolean(v.navItemId) !== Boolean(v.columnId), { message: 'Set exactly one of navItemId or columnId' })

// ---------------------------------------------------------------------------
// JSON column shapes
// ---------------------------------------------------------------------------

/** Json string-array columns (aliases, topics, boards, languages, includes, benefits, notes, highlights, testTypes). */
export const stringList = z.array(z.string().min(1))

/** [{label, value}] rows: Exam.eligibilityHighlights, TestSeries.extraStats. */
export const labelValueList = z.array(z.object({ label: z.string().min(1), value: z.union([z.string(), z.number()]) }))

/** ExamEligibilitySection.blocks */
export const eligibilityBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({ type: z.literal('note'), text: z.string().min(1) }),
  z.object({ type: z.literal('list'), items: stringList.min(1) }),
])
export const eligibilityBlocks = z.array(eligibilityBlock)
export type EligibilityBlock = z.infer<typeof eligibilityBlock>

// ---------------------------------------------------------------------------
// Money: catalogue prices are whole rupees; orders and payments are paise (what Razorpay uses).
// ---------------------------------------------------------------------------

export const rupees = z.number().int().nonnegative()
export const toPaise = (rupeesAmount: number) => Math.round(rupeesAmount * 100)
export const toRupees = (paise: number) => paise / 100
