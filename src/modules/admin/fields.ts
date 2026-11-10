import { z } from 'zod'
import { link, linkType, publishStatus, slug } from '../../shared/schemas.js'

/**
 * Field builders for admin input schemas. Empty strings from forms become null for optional fields,
 * so clearing an input clears the column.
 */
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const f = {
  /** required single-line text (VARCHAR 191 unless max given) */
  str: (max = 191) => z.string().trim().min(1, 'Required').max(max),
  /** optional single-line text */
  optStr: (max = 191) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional(),
  /** required long text */
  text: (max = 20_000) => z.string().trim().min(1, 'Required').max(max),
  optText: (max = 20_000) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional(),
  /** absolute URL, site path ("/images/x.png") */
  url: () => z.string().trim().min(1).max(2048).regex(/^(https?:\/\/|\/)/, 'Use a full URL (https://...) or a site path (/...)'),
  optUrl: () =>
    z
      .preprocess(emptyToNull, z.string().trim().max(2048).regex(/^(https?:\/\/|\/)/, 'Use a full URL (https://...) or a site path (/...)').nullable())
      .optional(),
  slug: () => slug,
  /** "Landmark": lucide icon name; the frontend maps it from its icon registry */
  icon: () => z.preprocess(emptyToNull, z.string().trim().regex(/^[A-Z][A-Za-z0-9]*$/, 'Use a lucide icon name, e.g. Landmark').max(64).nullable()).optional(),
  bool: () => z.boolean().optional(),
  int: (min = 0, max = 1_000_000) => z.number().int().min(min).max(max),
  optInt: (min = 0, max = 1_000_000) => z.number().int().min(min).max(max).nullable().optional(),
  sort: () => z.number().int().min(0).max(1_000_000).optional(),
  /** ISO date-time string -> Date */
  optDateTime: () => z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
  /** "YYYY-MM-DD" -> Date (DATE column); null = "To Be Announced" */
  optDate: () =>
    z
      .preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable())
      .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : v))
      .optional(),
  date: () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').transform((v) => new Date(`${v}T00:00:00Z`)),
  id: () => z.string().min(1).max(64),
  optId: () => z.preprocess(emptyToNull, z.string().min(1).max(64).nullable()).optional(),
  status: () => publishStatus.optional(),
  stringList: () => z.array(z.string().trim().min(1).max(500)).max(200).nullable().optional(),
  json: () => z.any().optional(),
}

/** linkType / linkRef / linkUrl (optionally prefixed: footerLinkType ...). Validated together by `checkLink`. */
export const linkFields = (prefix = '') => ({
  [`${prefix}${prefix ? 'L' : 'l'}inkType`]: linkType.optional(),
  [`${prefix}${prefix ? 'L' : 'l'}inkRef`]: f.optStr(191),
  [`${prefix}${prefix ? 'L' : 'l'}inkUrl`]: z
    .preprocess(
      emptyToNull,
      z
        .string()
        .trim()
        .max(2048)
        .regex(/^(https?:\/\/|\/|#|mailto:|tel:)/, 'Use https://..., a site path (/...), #anchor, mailto: or tel:')
        .nullable(),
    )
    .optional(),
})

/** Validates a merged (existing + patch) row's link triple; returns an issue list (empty = fine). */
export function checkLink(row: Record<string, unknown>, prefix = '') {
  const key = (k: string) => (prefix ? `${prefix}${k[0]!.toUpperCase()}${k.slice(1)}` : k)
  const value = { linkType: row[key('linkType')] ?? 'NONE', linkRef: row[key('linkRef')] ?? null, linkUrl: row[key('linkUrl')] ?? null }
  const r = link.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => ({ path: key(String(i.path[0] ?? 'linkType')), message: i.message }))
}
