/** Small presentation helpers so API payloads match what the frontend components display today. */

/** 12 -> "12 Months", 1 -> "1 Month" */
export const validityLabel = (months: number) => `${months} ${months === 1 ? 'Month' : 'Months'}`

/** DATE column -> "YYYY-MM-DD" (null stays null = "To Be Announced"). */
export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

/** Json string-array column -> string[] (tolerates null and bad data). */
export const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Json array column -> array (tolerates null). */
export const list = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Json object column -> object (tolerates null). */
export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export const discountPercent = (price: number, mrp: number) => (mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0)

/** Rows visible right now: visible + inside the optional publishAt / unpublishAt window. */
export const scheduledNow = (now = new Date()) => ({
  AND: [
    { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
    { OR: [{ unpublishAt: null }, { unpublishAt: { gt: now } }] },
  ],
})

/** Same for rows using startsAt / endsAt (banners, announcements). */
export const activeNow = (now = new Date()) => ({
  active: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
  ],
})
