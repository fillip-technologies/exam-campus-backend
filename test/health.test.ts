import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { hubOwner, link } from '../src/shared/schemas.js'

try {
  process.loadEnvFile('.env')
} catch {
  // CI sets the variables directly
}

describe('health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ env: { ...loadEnv(), NODE_ENV: 'test', LOG_LEVEL: 'silent' } })
  })
  afterAll(async () => {
    await app.close()
  })

  it('liveness answers without the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('readiness reaches the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok' })
  })

  it('allows the configured frontend origin only', async () => {
    const allowed = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } })
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const other = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } })
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('shared schemas', () => {
  it('requires exactly one hub owner', () => {
    expect(hubOwner.safeParse({ examId: 'a' }).success).toBe(true)
    expect(hubOwner.safeParse({ examId: 'a', classId: 'b' }).success).toBe(false)
    expect(hubOwner.safeParse({}).success).toBe(false)
  })

  it('validates the link triple', () => {
    expect(link.safeParse({ linkType: 'EXAM', linkRef: 'cuid123' }).success).toBe(true)
    expect(link.safeParse({ linkType: 'EXAM' }).success).toBe(false)
    expect(link.safeParse({ linkType: 'URL', linkUrl: '/about' }).success).toBe(true)
  })
})
