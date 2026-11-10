import { defineConfig } from 'prisma/config'

// Prisma 7 reads the connection URL from here instead of schema.prisma.
// Load .env for CLI commands (migrate, seed, studio); in CI/production the variables are already set.
try {
  process.loadEnvFile('.env')
} catch {
  // no .env file: rely on the environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // Placeholder lets `prisma generate` / `prisma validate` run without a database (e.g. npm install in CI).
    url: process.env.DATABASE_URL ?? 'mysql://user:pass@localhost:3306/placeholder',
    // Fixed shadow database for `prisma migrate dev`, so the DB user does not need server-wide CREATE rights.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
