import { z } from 'zod'

/**
 * `HomeSection.config` shape per section type (docs §4.2). Unknown keys are allowed so a frontend change can
 * add a setting before the backend knows it; known keys must have the right type.
 */
const optLabel = z.string().max(500).optional()

export const homeSectionConfig: Partial<Record<string, z.ZodType>> = {
  HERO: z.looseObject({
    seriesAnchorId: z.string().max(100).optional(),
    carouselAutoplayMs: z.number().int().min(0).max(60_000).optional(),
    cardsPerView: z.number().int().min(1).max(6).optional(),
  }),
  EXAM_CATEGORIES: z.looseObject({ examsPerCard: z.number().int().min(1).max(20).optional() }),
  PASS: z.looseObject({ buttonLabel: optLabel, secondaryLabel: optLabel, validityNote: optLabel }),
  FREE_TESTS: z.looseObject({
    maxRows: z.number().int().min(1).max(50).optional(),
    allFilterLabel: optLabel,
    featuredHighlights: z.array(z.string().max(500)).max(10).optional(),
    emptyRowsMessage: optLabel,
  }),
  EXAM_EXPERIENCE: z.looseObject({
    preview: z
      .looseObject({
        title: optLabel,
        meta: optLabel,
        totalQuestions: z.number().int().min(1).optional(),
        sections: z.array(z.string().max(191)).max(10).optional(),
        questions: z
          .array(z.object({ n: z.number().int().min(1), text: z.string().min(1).max(1000), options: z.array(z.string().max(191)).min(2).max(6) }))
          .max(10)
          .optional(),
      })
      .optional(),
  }),
  MOBILE_APP: z.looseObject({
    mode: z.enum(['WAITLIST', 'LIVE']).optional(),
    badge: optLabel,
    highlight: optLabel,
    formLabel: optLabel,
    placeholder: optLabel,
    buttonLabel: optLabel,
    successMessage: optLabel,
    playStoreUrl: z.url().nullable().optional(),
    appStoreUrl: z.url().nullable().optional(),
  }),
}

export function homeSectionConfigIssues(type: string, config: unknown) {
  const schema = homeSectionConfig[type]
  if (!schema || config == null) return []
  const r = schema.safeParse(config)
  return r.success ? [] : r.error.issues.map((i) => ({ path: ['config', ...i.path].join('.'), message: i.message }))
}
