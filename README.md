# ExamCampus Backend

API for the ExamCampus website and admin panel. Node 24 + TypeScript, Fastify 5, Prisma 7, MySQL 8.
The frontend is a separate repository and is hosted separately; it calls this API over HTTPS (CORS).

Plan and decisions: `docs/backend/backend-plan.md` (outside this repo for now).

## Quick start

```bash
cp .env.example .env        # then fill in the database password
npm install                 # also generates the Prisma client
npm run db:deploy           # apply migrations (or `npm run db:migrate` while changing the schema)
npm run db:seed             # import today's frontend content (needs the frontend repo checked out, see FRONTEND_DIR)
npm run admin:create -- --name "Your Name" --identifier you@example.com   # first SUPER_ADMIN (asks for the password)
npm run dev                 # http://localhost:4000/api/v1/health
```

Try it: `curl localhost:4000/api/v1/public/home`, or log in with
`curl -X POST localhost:4000/api/v1/auth/login -H 'content-type: application/json' -d '{"identifier":"you@example.com","password":"..."}'`
and call `/api/v1/admin/dashboard` with `Authorization: Bearer <accessToken>`.

## Database setup

Local development uses MariaDB/MySQL on this machine. Create the database, the shadow database Prisma Migrate
needs, and a user limited to those two (run as the database root user):

```sql
CREATE DATABASE examcampus        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE examcampus_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'examcampus'@'localhost' IDENTIFIED BY '<password>';
CREATE USER 'examcampus'@'127.0.0.1' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON examcampus.*        TO 'examcampus'@'localhost', 'examcampus'@'127.0.0.1';
GRANT ALL PRIVILEGES ON examcampus_shadow.* TO 'examcampus'@'localhost', 'examcampus'@'127.0.0.1';
```

Then set `DATABASE_URL` and `SHADOW_DATABASE_URL` in `.env`.

Production is **MySQL 8**. CI runs every migration against MySQL 8.4, so a migration that only works on MariaDB fails
there. `docker-compose.yml` has an optional MySQL 8.4 container (host port 3307) if you want MySQL locally:
`npm run db:up`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API with reload (tsx watch) |
| `npm run build` / `npm start` | compile to `dist/` and run it |
| `npm run typecheck` / `npm test` | tsc and vitest (tests need the database from `.env`) |
| `npm run db:migrate` | create + apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | apply pending migrations (CI, staging, production) |
| `npm run db:seed` | replace all content tables with the frontend's current data (refuses in production or once orders exist) |
| `npm run db:reset` | drop everything, re-run migrations and the seed |
| `npm run db:studio` | Prisma Studio |
| `npm run admin:create` | create a staff account, or reset its role/password (`--name`, `--identifier`, `--role`) |

## Layout

```
prisma/
  schema.prisma          database design (source of truth)
  migrations/            SQL migrations; the init one ends with hand-written CHECK constraints
  seed/                  imports exam-campus-frontend/src/data/* (+ home copy in seed/home-content.ts)
prisma.config.ts         Prisma 7 config: connection URLs, seed command
src/
  server.ts              starts the HTTP server
  app.ts                 builds the Fastify app (plugins + routes); used by tests
  config/env.ts          validated environment variables
  lib/db.ts              Prisma client (MariaDB driver adapter, works for MySQL and MariaDB)
  plugins/               Fastify plugins (app.db)
  modules/
    public/              /api/v1/public/*: layout, home, series, hubs, free tests, products, pages, search, forms
    auth/                /api/v1/auth/* and /api/v1/me: signup, login, refresh, OTP, password reset
    admin/               /api/v1/admin/*: generic CRUD (crud.ts) + resource list (resources.ts) + media, users, revisions
    health/
  lib/links.ts           resolveLink: link triple -> href, one query per entity type
  lib/cache.ts           public response cache (in memory; Redis when there is more than one instance)
  lib/storage.ts         file storage: Cloudinary (production) or local disk (development)
  shared/schemas.ts      Zod schemas: link triple, "exactly one owner" rules, JSON column shapes
  shared/identity.ts     email / mobile identifier, password and name rules (same as the frontend)
  generated/prisma/      generated client (git-ignored)
scripts/create-admin.ts  staff accounts
test/                    vitest
uploads/                 uploaded files with the local driver (git-ignored)
```

## Accounts and files

- **Everyone logs in the same way** (customers and staff): email or 10-digit mobile + password, or a one-time code.
  The role decides access: `STUDENT` < `SUPPORT` < `EDITOR` < `ADMIN` < `SUPER_ADMIN`.
- **OTP codes** are printed in the server log for now (`OTP_DELIVERY=log`); production needs an SMS/email provider.
- **Uploads** (images and PDFs) go to **Cloudinary** with `STORAGE_DRIVER=cloudinary` + `CLOUDINARY_URL`
  (`src/lib/storage.ts`). Files land in the `CLOUDINARY_FOLDER` folder of the Cloudinary media library; images are
  served with `f_auto,q_auto` (WebP/AVIF, compressed per browser), PDFs as raw files. Deleting a file in the admin
  removes it from Cloudinary and purges the CDN copy. Without a Cloudinary account (local development, tests)
  `STORAGE_DRIVER=local` keeps files in `UPLOAD_DIR`, served at `/uploads/*`.

## Rules worth knowing

- **Links** store the target's id in `linkRef` (`linkType=EXAM`, `linkRef=<Exam.id>`), so slug renames never break menus.
- **"Exactly one owner"** (`examId` XOR `classId` etc.) is validated with the Zod schemas in `src/shared/schemas.ts`.
  Only `Order` / `Enrollment` have a database CHECK, because their foreign keys are `RESTRICT`.
- **Money:** catalogue prices are whole rupees; orders and payments are paise (`amountPaise`).
- **Sold products are archived, never deleted:** `Order` → `TestSeries` / `Pass` is `RESTRICT`.
