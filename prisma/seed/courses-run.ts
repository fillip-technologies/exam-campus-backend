// npm run db:seed:courses: adds the starter courses, teachers and coupon (prisma/seed/courses.ts) without wiping anything.
import { createPrisma } from '../../src/lib/db.js'
import { seedCourses } from './courses.js'

try {
  process.loadEnvFile('.env')
} catch {
  // variables come from the environment
}
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production.')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

const db = createPrisma(databaseUrl)
try {
  console.log('Added', await seedCourses(db))
} finally {
  await db.$disconnect()
}
