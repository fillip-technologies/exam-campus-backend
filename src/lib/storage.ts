import { createHash, randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import type { Env } from '../config/env.js'

/**
 * File storage behind one small interface. STORAGE_DRIVER in .env picks where NEW uploads go:
 *   "cloudinary"  images and PDFs in Cloudinary, served from its CDN
 *   "local"       files in UPLOAD_DIR on this server, served by the API at /uploads/*
 * `key` is our own path ("posters/2026/11/k3j2h4.jpg"). MediaAsset stores the key and the driver it went to, so
 * switching drivers later keeps every older file working and deletable.
 */
export type StorageDriver = 'local' | 'cloudinary'

export interface Storage {
  driver: StorageDriver
  put(key: string, body: Readable): Promise<{ key: string; url: string; sizeBytes: number }>
  delete(key: string): Promise<void>
  urlFor(key: string): string
}

export const localPublicBase = (env: Env) => (env.PUBLIC_UPLOAD_URL ?? `http://localhost:${env.PORT}/uploads`).replace(/\/$/, '')

/** The driver new uploads go to (STORAGE_DRIVER). */
export function createStorage(env: Env): Storage {
  return createStorages(env).active
}

/**
 * Every driver this server can reach: local always, Cloudinary when CLOUDINARY_URL is set (even while
 * STORAGE_DRIVER=local, so files uploaded before a switch can still be deleted).
 */
export function createStorages(env: Env) {
  const drivers: Partial<Record<StorageDriver, Storage>> = {
    local: localStorage(path.resolve(env.UPLOAD_DIR), localPublicBase(env)),
  }
  if (env.CLOUDINARY_URL) drivers.cloudinary = cloudinaryStorage(parseCloudinaryUrl(env.CLOUDINARY_URL), env.CLOUDINARY_FOLDER)
  return {
    active: drivers[env.STORAGE_DRIVER]!,
    /** null when the driver is not configured here (e.g. a Cloudinary file while CLOUDINARY_URL is empty) */
    get: (driver: string) => drivers[driver as StorageDriver] ?? null,
  }
}

// ---------------------------------------------------------------------------
// Cloudinary (REST upload API, signed requests; no SDK needed)
// ---------------------------------------------------------------------------

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

/** cloudinary://<api_key>:<api_secret>@<cloud_name> */
export function parseCloudinaryUrl(url: string): CloudinaryConfig {
  const u = new URL(url)
  return { apiKey: decodeURIComponent(u.username), apiSecret: decodeURIComponent(u.password), cloudName: u.hostname }
}

/** Cloudinary request signature: SHA-1 of the sorted "k=v&k=v" params followed by the API secret. */
export function cloudinarySignature(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

/**
 * Where a key lives in Cloudinary. Images are "image" assets (the public id has no extension; Cloudinary converts
 * them on delivery). PDFs are "raw" assets: Cloudinary blocks delivery of PDFs uploaded as images by default, and
 * raw files are served byte-for-byte (the public id keeps ".pdf").
 */
export function cloudinaryTarget(folder: string, key: string) {
  const ext = path.extname(key).slice(1).toLowerCase()
  const raw = ext === 'pdf'
  const publicId = `${folder}/${raw ? key : key.slice(0, -(ext.length + 1))}`
  return { resourceType: raw ? ('raw' as const) : ('image' as const), publicId, ext }
}

function cloudinaryStorage(cfg: CloudinaryConfig, folder: string, fetchImpl: typeof fetch = fetch): Storage {
  const api = (resourceType: string, action: string) => `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/${action}`

  /** Images: f_auto,q_auto = WebP/AVIF at a sensible quality for each browser, from the CDN. */
  const urlFor = (key: string) => {
    const t = cloudinaryTarget(folder, key)
    return t.resourceType === 'raw'
      ? `https://res.cloudinary.com/${cfg.cloudName}/raw/upload/${t.publicId}`
      : `https://res.cloudinary.com/${cfg.cloudName}/image/upload/f_auto,q_auto/${t.publicId}.${t.ext}`
  }

  async function call(resourceType: string, action: string, params: Record<string, string | number>, file?: Buffer) {
    const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) }
    const form = new FormData()
    for (const [k, v] of Object.entries(signed)) form.append(k, String(v))
    form.append('api_key', cfg.apiKey)
    form.append('signature', cloudinarySignature(signed, cfg.apiSecret))
    if (file) form.append('file', new Blob([new Uint8Array(file)]))
    const res = await fetchImpl(api(resourceType, action), { method: 'POST', body: form })
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, unknown>
    if (!res.ok) throw new Error(`Cloudinary ${action} failed (${res.status}): ${body.error?.message ?? 'unknown error'}`)
    return body
  }

  return {
    driver: 'cloudinary',
    urlFor,
    async put(key, body) {
      const chunks: Buffer[] = []
      for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const file = Buffer.concat(chunks)
      const t = cloudinaryTarget(folder, key)
      const res = await call(t.resourceType, 'upload', { public_id: t.publicId, overwrite: 'false' }, file)
      return { key, url: urlFor(key), sizeBytes: Number(res.bytes ?? file.length) }
    },
    async delete(key) {
      const t = cloudinaryTarget(folder, key)
      // invalidate = also purge the CDN copy; "not found" is fine (already gone)
      const res = await call(t.resourceType, 'destroy', { public_id: t.publicId, invalidate: 'true' })
      if (res.result !== 'ok' && res.result !== 'not found') throw new Error(`Cloudinary destroy failed: ${String(res.result)}`)
    },
  }
}

/** For tests: a Cloudinary driver with a fake fetch. */
export const cloudinaryStorageForTest = cloudinaryStorage

function localStorage(root: string, publicBase: string): Storage {
  const resolve = (key: string) => {
    const file = path.resolve(root, key)
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid storage key')
    return file
  }
  const urlFor = (key: string) => `${publicBase}/${key}`
  return {
    driver: 'local',
    urlFor,
    async put(key, body) {
      const file = resolve(key)
      await mkdir(path.dirname(file), { recursive: true })
      await pipeline(body, createWriteStream(file, { flags: 'wx' }))
      return { key, url: urlFor(key), sizeBytes: (await stat(file)).size }
    },
    async delete(key) {
      await rm(resolve(key), { force: true })
    },
  }
}

/** Upload types the media library accepts, detected from the file's first bytes (not the browser's claim). */
const signatures: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 4).toString() === 'GIF8' },
  { mime: 'image/avif', ext: 'avif', test: (b) => b.subarray(4, 12).toString() === 'ftypavif' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
]
// SVG is refused on purpose: it can carry scripts. Convert logos to PNG/WebP first.

export const sniffType = (head: Buffer) => signatures.find((s) => s.test(head)) ?? null

/** Image width/height from the file header (PNG, JPEG, GIF, WebP); null when unknown. */
export function imageSize(b: Buffer): { width: number; height: number } | null {
  if (b.length < 24) return null
  if (b[0] === 0x89 && b.subarray(12, 16).toString() === 'IHDR') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b.subarray(0, 4).toString() === 'GIF8') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') {
    const chunk = b.subarray(12, 16).toString()
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]!
      const length = b.readUInt16BE(i + 2)
      // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      }
      i += 2 + length
    }
  }
  return null
}

/** "posters/2026/11/k3j2h4.jpg" */
export const newKey = (folder: string, ext: string, now = new Date()) =>
  `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(9).toString('base64url')}.${ext}`
