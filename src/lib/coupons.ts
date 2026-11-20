import type { Coupon } from '../generated/prisma/client.js'
import type { Db } from './db.js'
import { isoDate } from './format.js'

type Target = Coupon & { courses: { courseId: string }[]; series: { seriesId: string }[] }

/** Is the coupon usable right now: switched on, started, not expired, not used up. */
const live = (c: Coupon, now: Date) =>
  c.active && (!c.validFrom || c.validFrom <= now) && (!c.validTo || c.validTo >= now) && (c.maxUses == null || c.usedCount < c.maxUses)

const saving = (c: Coupon, price: number) => (c.type === 'PERCENT' ? Math.round((price * c.value) / 100) : Math.min(c.value, price))

/** Coupon as the product cards expect it: { code, discountPercent | discountAmount, label, validTill }. */
const toCard = (c: Coupon) => ({
  code: c.code,
  discountPercent: c.type === 'PERCENT' ? c.value : null,
  discountAmount: c.type === 'FLAT' ? c.value : null,
  label: c.label,
  validTill: c.validTo ? isoDate(c.validTo) : null,
})

/**
 * Loads the coupons that can show right now. A coupon shows on every course / series ("all") or only on the
 * ones picked for it. When several apply to one card, the card shows the one that saves the most.
 * Expired, not yet started, switched off or used up coupons never show.
 */
export async function loadCoupons(db: Db, now = new Date()) {
  const rows: Target[] = await db.coupon.findMany({
    where: { active: true },
    include: { courses: { select: { courseId: true } }, series: { select: { seriesId: true } } },
  })
  const coupons = rows.filter((c) => live(c, now))
  const best = (matches: (c: Target) => boolean, price: number) => {
    const found = coupons.filter(matches).sort((a, b) => saving(b, price) - saving(a, price))[0]
    return found ? toCard(found) : null
  }
  return {
    forCourse: (id: string, price: number) => best((c) => c.allCourses || c.courses.some((x) => x.courseId === id), price),
    forSeries: (id: string, price: number) => best((c) => c.allSeries || c.series.some((x) => x.seriesId === id), price),
  }
}

export type CouponPicker = Awaited<ReturnType<typeof loadCoupons>>
