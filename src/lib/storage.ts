import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import type { Env } from '../config/env.js'

/**
 * File storage behind one small interface. Today: "local" (files on this server's disk, served by the API at
 * /uploads/*). Later an S3 / R2 driver implements the same three methods and the rest of the code does not change.
 */
export interface Storage {
  put(key: string, body: Readable): Promise<{ key: string; url: string; sizeBytes: number }>
  delete(key: string): Promise<void>
  urlFor(key: string): string
}

export function createStorage(env: Env): Storage {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return localStorage(path.resolve(env.UPLOAD_DIR), (env.PUBLIC_UPLOAD_URL ?? `http://localhost:${env.PORT}/uploads`).replace(/\/$/, ''))
  }
}

function localStorage(root: string, publicBase: string): Storage {
  const resolve = (key: string) => {
    const file = path.resolve(root, key)
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid storage key')
    return file
  }
  const urlFor = (key: string) => `${publicBase}/${key}`
  return {
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
