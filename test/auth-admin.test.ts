import { rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { hashPassword, sha256 } from '../src/lib/password.js'

try {
  process.loadEnvFile('.env')
} catch {
  // CI sets the variables directly
}

const ORIGIN = 'http://localhost:5173'
const STUDENT = { name: 'ZZ Student', identifier: 'zz-admin-student@example.com', password: 'student-pass-1' }
const EDITOR = { email: 'zz-admin-editor@example.com', password: 'editor-pass-1' }

let app: Awaited<ReturnType<typeof buildApp>>

type Res = Awaited<ReturnType<typeof app.inject>>
const cookieOf = (res: Res) => {
  const c = res.cookies.find((x) => x.name === 'ec_refresh')
  return c ? `ec_refresh=${c.value}` : ''
}

async function cleanup() {
  const db = app.db
  const users = await db.user.findMany({ where: { OR: [{ email: { startsWith: 'zz-admin' } }, { mobile: '9999999990' }] }, select: { id: true } })
  const ids = users.map((u) => u.id)
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } })
  await db.contentRevision.deleteMany({ where: { createdById: { in: ids } } })
  await db.session.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.otpCode.deleteMany({ where: { identifier: { startsWith: 'zz-admin' } } })
  await db.page.deleteMany({ where: { slug: { startsWith: 'zz-admin' } } })
  await db.exam.deleteMany({ where: { slug: { startsWith: 'zz-admin' } } })
  await db.examCategory.deleteMany({ where: { slug: { startsWith: 'zz-admin' } } })
  await db.examOrganization.deleteMany({ where: { key: { startsWith: 'zz-admin' } } })
  await db.slugRedirect.deleteMany({ where: { oldSlug: { startsWith: 'zz-admin' } } })
  await db.mediaAsset.deleteMany({ where: { folder: 'zz-admin' } })
  await rm(path.resolve(process.env.UPLOAD_DIR ?? 'uploads', 'zz-admin'), { recursive: true, force: true })
}

beforeAll(async () => {
  app = await buildApp({ env: { ...loadEnv(), NODE_ENV: 'test', LOG_LEVEL: 'silent' } })
  await cleanup()
  await app.db.user.create({ data: { name: 'ZZ Editor', email: EDITOR.email, role: 'EDITOR', passwordHash: await hashPassword(EDITOR.password) } })
})

afterAll(async () => {
  await cleanup()
  await app.close()
})

describe('student accounts', () => {
  let access = ''
  let cookie = ''

  it('signs up with the frontend authService shape', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', headers: { origin: ORIGIN }, payload: STUDENT })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.user).toMatchObject({ name: STUDENT.name, identifier: STUDENT.identifier, role: 'STUDENT' })
    expect(body.accessToken).toBeTypeOf('string')
    const set = res.cookies.find((c) => c.name === 'ec_refresh')!
    expect(set.httpOnly).toBe(true)
    expect(set.path).toBe('/api/v1/auth')
    access = body.accessToken
    cookie = cookieOf(res)
  })

  it('refuses a duplicate account with the frontend message', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', headers: { origin: ORIGIN }, payload: { ...STUDENT, identifier: STUDENT.identifier.toUpperCase() } })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toMatch(/already exists/)
  })

  it('logs in by email; wrong password gets the same message as unknown account', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: STUDENT.identifier, password: STUDENT.password } })
    expect(ok.statusCode).toBe(200)
    const wrong = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: STUDENT.identifier, password: 'nope-nope' } })
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: 'zz-admin-nobody@example.com', password: 'nope-nope' } })
    expect(wrong.statusCode).toBe(401)
    expect(unknown.json().message).toBe(wrong.json().message)
  })

  it('reads /me with the access token and rejects without it', async () => {
    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: `Bearer ${access}` } })
    expect(me.json()).toMatchObject({ name: STUDENT.name, role: 'STUDENT' })
    expect((await app.inject({ method: 'GET', url: '/api/v1/me' })).statusCode).toBe(401)
  })

  it('rotates the refresh cookie; the previous one stops working', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { origin: ORIGIN, cookie } })
    expect(first.statusCode).toBe(200)
    const next = cookieOf(first)
    expect(next).not.toBe(cookie)
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie } })).statusCode).toBe(401)
    cookie = next
  })

  it('blocks cookie endpoints from other origins', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { origin: 'https://evil.example', cookie } })
    expect(res.statusCode).toBe(403)
  })

  it('keeps students out of the admin API', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/exams', headers: { authorization: `Bearer ${access}` } })
    expect(res.statusCode).toBe(403)
  })

  it('logs in with a one-time code', async () => {
    const req = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { identifier: STUDENT.identifier, purpose: 'LOGIN' } })
    expect(req.statusCode).toBe(202)
    // the code went to the log; replace it with a known one to test verification
    await app.db.otpCode.updateMany({ where: { identifier: STUDENT.identifier, purpose: 'LOGIN' }, data: { codeHash: sha256(`${STUDENT.identifier}:123456`) } })
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { identifier: STUDENT.identifier, code: '000000' } })).statusCode).toBe(401)
    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { identifier: STUDENT.identifier, code: '123456' } })
    expect(ok.statusCode).toBe(200)
    // a code works once
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { identifier: STUDENT.identifier, code: '123456' } })).statusCode).toBe(401)
  })

  it('logout revokes the session', async () => {
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie } })
    expect(out.statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: `Bearer ${access}` } })).statusCode).toBe(401)
  })

  it('accepts a 10-digit mobile as identifier', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', payload: { name: 'ZZ Mobile', identifier: '99999 99990', password: 'mobile-pass-1' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().user).toMatchObject({ identifier: '9999999990', mobile: '9999999990', email: null })
  })
})

describe('admin API', () => {
  let auth: Record<string, string> = {}
  const ids = { category: '', org: '', exam: '' }

  beforeAll(async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: EDITOR.email, password: EDITOR.password } })
    auth = { authorization: `Bearer ${res.json().accessToken}` }
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url: `/api/v1/admin${url}`, headers: auth, ...(payload ? { payload: payload as object } : {}) })

  it('creates catalogue rows and writes an audit entry', async () => {
    const cat = await call('POST', '/exam-categories', { slug: 'zz-admin-cat', label: 'ZZ Cat' })
    expect(cat.statusCode).toBe(201)
    const org = await call('POST', '/organizations', { key: 'zz-admin-org', name: 'ZZ Org' })
    const exam = await call('POST', '/exams', { slug: 'zz-admin-exam', name: 'ZZ Exam', categoryId: cat.json().id, orgId: org.json().id })
    expect(exam.statusCode).toBe(201)
    expect(exam.json().status).toBe('DRAFT')
    Object.assign(ids, { category: cat.json().id, org: org.json().id, exam: exam.json().id })
    const log = await app.db.auditLog.findFirst({ where: { entityType: 'exam', entityId: ids.exam, action: 'exam.create' } })
    expect(log).not.toBeNull()
  })

  it('returns field issues for bad input', async () => {
    const res = await call('POST', '/exams', { slug: 'Bad Slug', name: '', categoryId: ids.category, orgId: ids.org })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues.map((i: { path: string }) => i.path).sort()).toEqual(['name', 'slug'])
  })

  it('enforces "exactly one owner" and link targets', async () => {
    const both = await call('POST', '/quick-info', { examId: ids.exam, classId: 'x', label: 'L' })
    expect(both.statusCode).toBe(400)
    const badLink = await call('POST', '/exam-resources', { examId: ids.exam, type: 'T', title: 'R', linkType: 'EXAM', linkRef: 'does-not-exist' })
    expect(badLink.statusCode).toBe(400)
    expect(badLink.json().issues[0].path).toBe('linkRef')
    const anchor = await call('POST', '/exam-resources', { examId: ids.exam, type: 'T', title: 'R', linkType: 'ANCHOR', linkRef: 'syllabus' })
    expect(anchor.statusCode).toBe(201)
  })

  it('publishes, stamps publishedAt and clears the public cache', async () => {
    expect((await app.inject({ url: '/api/v1/public/exams/zz-admin-exam' })).statusCode).toBe(404)
    const pub = await call('POST', `/exams/${ids.exam}/publish`)
    expect(pub.json().status).toBe('PUBLISHED')
    expect(pub.json().publishedAt).not.toBeNull()
    expect((await app.inject({ url: '/api/v1/public/exams/zz-admin-exam' })).statusCode).toBe(200)
  })

  it('keeps the old URL working after a slug rename', async () => {
    await call('PATCH', `/exams/${ids.exam}`, { slug: 'zz-admin-exam-2' })
    const old = await app.inject({ url: '/api/v1/public/exams/zz-admin-exam' })
    expect(old.json().redirect).toBe('/exams/zz-admin-exam-2')
  })

  it('publishes resources without a publishedAt column (pages, series)', async () => {
    const page = await call('POST', '/pages', { slug: 'zz-admin-page', title: 'ZZ', body: '# Hi' })
    expect(page.statusCode).toBe(201)
    const pub = await call('POST', `/pages/${page.json().id}/publish`)
    expect(pub.statusCode).toBe(200)
    expect(pub.json().status).toBe('PUBLISHED')
    expect((await app.inject({ url: '/api/v1/public/pages/zz-admin-page' })).statusCode).toBe(200)
    const series = await call('POST', '/series', { slug: 'zz-admin-s0', examId: ids.exam, title: 'S0', validityMonths: 12, price: 1, mrp: 2 })
    expect((await call('POST', `/series/${series.json().id}/publish`)).statusCode).toBe(200)
  })

  it('keeps one primary series per exam', async () => {
    const a = await call('POST', '/series', { slug: 'zz-admin-s1', examId: ids.exam, title: 'S1', validityMonths: 12, price: 1, mrp: 2, isPrimary: true })
    const b = await call('POST', '/series', { slug: 'zz-admin-s2', examId: ids.exam, title: 'S2', validityMonths: 12, price: 1, mrp: 2, isPrimary: true })
    expect(b.statusCode).toBe(201)
    expect((await call('GET', `/series/${a.json().id}`)).json().isPrimary).toBe(false)
    expect((await call('POST', '/series', { slug: 'zz-admin-s3', examId: ids.exam, title: 'S3', validityMonths: 12, price: 5, mrp: 2 })).statusCode).toBe(400)
  })

  it('reorders and undoes an edit from its revision', async () => {
    const d1 = await call('POST', '/exam-dates', { examId: ids.exam, event: 'First', date: null })
    const d2 = await call('POST', '/exam-dates', { examId: ids.exam, event: 'Second', date: '2027-01-31' })
    await call('PATCH', '/exam-dates/reorder', { ids: [d2.json().id, d1.json().id] })
    const listed = await call('GET', `/exam-dates?examId=${ids.exam}`)
    expect(listed.json().items.map((d: { event: string }) => d.event)).toEqual(['Second', 'First'])

    await call('PATCH', `/exam-dates/${d1.json().id}`, { event: 'Renamed' })
    const revs = await call('GET', `/revisions?entityType=examDate&entityId=${d1.json().id}`)
    const restore = await call('POST', `/revisions/${revs.json().items[0].id}/restore`)
    expect(restore.statusCode).toBe(200)
    expect((await call('GET', `/exam-dates/${d1.json().id}`)).json().event).toBe('First')
  })

  it('leaves admin-only settings to admins', async () => {
    expect((await call('PATCH', '/site-settings', { siteName: 'Nope' })).statusCode).toBe(403)
    expect((await call('POST', '/users', { name: 'X', identifier: 'zz-admin-x@example.com', password: 'xxxxxxxx', role: 'ADMIN' })).statusCode).toBe(403)
  })

  it('stores uploads on this server and refuses unknown file types', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030806000000', 'hex')
    const form = (name: string, body: Buffer, type: string) => {
      const boundary = '----zztest'
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\nzz-admin\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`),
        body,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ])
      return { payload, headers: { ...auth, 'content-type': `multipart/form-data; boundary=${boundary}` } }
    }
    const up = await app.inject({ method: 'POST', url: '/api/v1/admin/media', ...form('logo.png', png, 'image/png') })
    expect(up.statusCode).toBe(201)
    expect(up.json()).toMatchObject({ mime: 'image/png', width: 2, height: 3, folder: 'zz-admin' })
    const key = up.json().key as string
    const served = await app.inject({ url: `/uploads/${key}` })
    expect(served.statusCode).toBe(200)
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin')

    const svg = await app.inject({ method: 'POST', url: '/api/v1/admin/media', ...form('x.svg', Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml') })
    expect(svg.statusCode).toBe(415)

    expect((await call('DELETE', `/media/${up.json().id}`)).statusCode).toBe(204)
    expect((await app.inject({ url: `/uploads/${key}` })).statusCode).toBe(404)
  })
})
