import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { cloudinarySignature, cloudinaryStorageForTest, cloudinaryTarget, createStorages, parseCloudinaryUrl } from '../src/lib/storage.js'

const cfg = { cloudName: 'demo-cloud', apiKey: '1234', apiSecret: 'shhh' }

/** Records calls and answers like Cloudinary. */
function fakeFetch(answer: Record<string, unknown>, status = 200) {
  const calls: { url: string; fields: Record<string, string>; hasFile: boolean }[] = []
  const impl = (async (url: string, init: { body: FormData }) => {
    const fields: Record<string, string> = {}
    let hasFile = false
    for (const [k, v] of init.body.entries()) {
      if (typeof v === 'string') fields[k] = v
      else hasFile = true
    }
    calls.push({ url, fields, hasFile })
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('cloudinary storage', () => {
  it('signs like the Cloudinary docs example', () => {
    // https://cloudinary.com/documentation/authentication_signatures
    expect(cloudinarySignature({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')).toBe(
      'bfd09f95f331f558cbd1320e67aa8d488770583e',
    )
  })

  it('parses CLOUDINARY_URL and requires it for the cloudinary driver', () => {
    expect(parseCloudinaryUrl('cloudinary://key:sec%2Fret@my-cloud')).toEqual({ apiKey: 'key', apiSecret: 'sec/ret', cloudName: 'my-cloud' })
    const base = { DATABASE_URL: 'mysql://x', JWT_SECRET: 'x'.repeat(32), STORAGE_DRIVER: 'cloudinary' }
    expect(() => loadEnv(base)).toThrow(/CLOUDINARY_URL/)
    expect(loadEnv({ ...base, CLOUDINARY_URL: 'cloudinary://k:s@c' }).CLOUDINARY_FOLDER).toBe('examcampus')
  })

  it('maps images to image assets without extension and PDFs to raw assets', () => {
    expect(cloudinaryTarget('ec', 'posters/2026/11/abc.jpg')).toEqual({ resourceType: 'image', publicId: 'ec/posters/2026/11/abc', ext: 'jpg' })
    expect(cloudinaryTarget('ec', 'pdfs/2026/11/abc.pdf')).toEqual({ resourceType: 'raw', publicId: 'ec/pdfs/2026/11/abc.pdf', ext: 'pdf' })
  })

  it('uploads with a signed request and returns the CDN url', async () => {
    const f = fakeFetch({ bytes: 1234 })
    const s = cloudinaryStorageForTest(cfg, 'ec', f.impl)
    const out = await s.put('posters/2026/11/abc.jpg', Readable.from(Buffer.from('fake image')))
    expect(out).toEqual({ key: 'posters/2026/11/abc.jpg', url: 'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/ec/posters/2026/11/abc.jpg', sizeBytes: 1234 })
    const c = f.calls[0]!
    expect(c.url).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload')
    expect(c.hasFile).toBe(true)
    expect(c.fields.api_key).toBe('1234')
    expect(c.fields.public_id).toBe('ec/posters/2026/11/abc')
    const { api_key: _k, signature, ...signed } = c.fields
    expect(signature).toBe(cloudinarySignature(signed, 'shhh'))
  })

  it('uploads PDFs as raw files and deletes from the right resource type', async () => {
    const f = fakeFetch({ result: 'ok', bytes: 10 })
    const s = cloudinaryStorageForTest(cfg, 'ec', f.impl)
    const out = await s.put('pdfs/2026/11/p.pdf', Readable.from(Buffer.from('%PDF-1.4')))
    expect(out.url).toBe('https://res.cloudinary.com/demo-cloud/raw/upload/ec/pdfs/2026/11/p.pdf')
    await s.delete('pdfs/2026/11/p.pdf')
    expect(f.calls[1]!.url).toBe('https://api.cloudinary.com/v1_1/demo-cloud/raw/destroy')
    expect(f.calls[1]!.fields.invalidate).toBe('true')
  })

  it('reports Cloudinary errors', async () => {
    const f = fakeFetch({ error: { message: 'Invalid Signature' } }, 401)
    const s = cloudinaryStorageForTest(cfg, 'ec', f.impl)
    await expect(s.put('a/b.png', Readable.from(Buffer.from('x')))).rejects.toThrow(/Invalid Signature/)
  })
})

describe('storage driver switch (.env STORAGE_DRIVER)', () => {
  const base = { DATABASE_URL: 'mysql://x', JWT_SECRET: 'x'.repeat(32) }

  it('defaults to the upload folder on this server', () => {
    const s = createStorages(loadEnv(base))
    expect(s.active.driver).toBe('local')
    expect(s.active.urlFor('a/b.png')).toBe('http://localhost:4000/uploads/a/b.png')
    expect(s.get('cloudinary')).toBeNull() // no account configured
  })

  it('sends new uploads to Cloudinary but keeps local files reachable', () => {
    const s = createStorages(loadEnv({ ...base, STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: 'cloudinary://k:s@c' }))
    expect(s.active.driver).toBe('cloudinary')
    expect(s.get('local')?.driver).toBe('local')
  })

  it('still deletes Cloudinary files after switching back to local while CLOUDINARY_URL is set', () => {
    const s = createStorages(loadEnv({ ...base, STORAGE_DRIVER: 'local', CLOUDINARY_URL: 'cloudinary://k:s@c' }))
    expect(s.active.driver).toBe('local')
    expect(s.get('cloudinary')?.driver).toBe('cloudinary')
  })

  it('needs a public upload URL for the local driver in production', () => {
    const prod = { ...base, NODE_ENV: 'production', ALLOW_OTP_LOG_IN_PRODUCTION: 'true', STORAGE_DRIVER: 'local' }
    expect(() => loadEnv(prod)).toThrow(/PUBLIC_UPLOAD_URL/)
    expect(createStorages(loadEnv({ ...prod, PUBLIC_UPLOAD_URL: 'https://api.example.com/uploads/' })).active.urlFor('a.pdf')).toBe('https://api.example.com/uploads/a.pdf')
  })
})
