/**
 * Starter courses, teachers and a coupon: the sample Courses / Faculty sections the frontend showed before
 * they came from the database (formerly src/data/sampleCourses.js), now as real rows you can edit in the admin.
 *
 *   npm run db:seed:courses     adds them to the current database (nothing is wiped)
 *   npm run db:seed             the full seed also runs this at the end
 *
 * Every PUBLISHED exam gets the three sample courses and four teachers, unless it already has courses /
 * teachers (so running it twice adds nothing). The SBIPO10 coupon (10% off) is shown on each exam's
 * Foundation Batch course.
 *
 * PLACEHOLDER content: the teachers are not real people and the video is a public sample. Replace them in
 * the admin panel (Exams → Courses / Faculty).
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js'

const SAMPLE_VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
export const SAMPLE_COUPON = 'SBIPO10'

const faculty = [
  { name: 'Quant Faculty', subject: 'Quantitative Aptitude' },
  { name: 'Reasoning Faculty', subject: 'Reasoning Ability' },
  { name: 'English Faculty', subject: 'English Language' },
  { name: 'Banking Faculty', subject: 'Banking Awareness' },
]

const courses = (examName: string) => [
  {
    title: `${examName} Foundation Batch (Prelims + Mains)`,
    subtitle: 'Prelims + Mains',
    mode: 'LIVE' as const,
    languages: ['Hinglish'],
    faculty: ['ExamCampus Faculty'],
    startDate: new Date('2026-12-15T00:00:00Z'),
    liveClasses: 250,
    recordedVideos: 400,
    totalTests: 120,
    includes: ['Live classes with doubt solving', 'Recordings of every class', 'PDF notes', 'Mock tests with analysis'],
    images: ['/images/students/banker.jpg'],
    demoVideoUrl: SAMPLE_VIDEO,
    price: 2999,
    mrp: 6999,
    validityMonths: 12,
    offerLabel: 'Bestseller',
    isPrimary: true,
    withCoupon: true,
  },
  {
    title: `${examName} Mains Crash Course`,
    subtitle: 'Mains only',
    mode: 'RECORDED' as const,
    languages: ['English', 'Hindi'],
    recordedVideos: 180,
    totalTests: 30,
    includes: ['Recorded video lessons', 'Descriptive writing practice', 'Mains mock tests'],
    demoVideoUrl: SAMPLE_VIDEO,
    price: 1499,
    mrp: 2999,
    validityMonths: 6,
  },
  {
    title: `${examName} Interview Guidance`,
    subtitle: 'Interview',
    mode: 'HYBRID' as const,
    languages: ['English'],
    liveClasses: 20,
    includes: ['Live sessions', 'Mock interview', 'Group exercise practice'],
    price: 999,
    mrp: 1999,
    validityMonths: 3,
  },
]

export async function seedCourses(db: PrismaClient) {
  const now = new Date()
  // valid till the end of next month, so the sample offer shows with a date and does not expire right away
  const validTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59))
  const coupon = await db.coupon.upsert({
    where: { code: SAMPLE_COUPON },
    create: { code: SAMPLE_COUPON, type: 'PERCENT', value: 10, label: 'Extra 10% off', validTo },
    update: {},
  })

  const exams = await db.exam.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, name: true, _count: { select: { courses: true, faculty: true } } },
  })
  let addedCourses = 0
  let addedFaculty = 0
  for (const exam of exams) {
    if (!exam._count.courses) {
      for (const [sort, { withCoupon, ...c }] of courses(exam.name).entries()) {
        await db.course.create({
          data: {
            ...c,
            examId: exam.id,
            status: 'PUBLISHED',
            sort,
            ...(withCoupon ? { coupons: { create: [{ couponId: coupon.id }] } } : {}),
          },
        })
        addedCourses++
      }
    }
    if (!exam._count.faculty) {
      await db.faculty.createMany({ data: faculty.map((t, sort) => ({ ...t, examId: exam.id, demoVideoUrl: SAMPLE_VIDEO, sort })) })
      addedFaculty += faculty.length
    }
  }
  return { exams: exams.length, courses: addedCourses, faculty: addedFaculty, coupon: coupon.code }
}
