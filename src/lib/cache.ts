/**
 * Response cache for public GETs. Content changes only through admin writes, so entries live until
 * `invalidate()` (called after every admin write) or the TTL as a safety net.
 *
 * In-memory per process: fine for one API instance. With several instances, swap this for Redis
 * (same interface) so an admin write clears every instance.
 */
export interface Cache {
  wrap<T>(key: string, load: () => Promise<T>): Promise<T>
  invalidate(): void
}

export function createMemoryCache({ ttlMs = 5 * 60_000, enabled = true } = {}): Cache {
  const entries = new Map<string, { expires: number; value: Promise<unknown> }>()
  let generation = 0

  return {
    async wrap<T>(key: string, load: () => Promise<T>): Promise<T> {
      if (!enabled) return load()
      const hit = entries.get(key)
      if (hit && hit.expires > Date.now()) return hit.value as Promise<T>
      const gen = generation
      const value = load()
      entries.set(key, { expires: Date.now() + ttlMs, value })
      try {
        return await value
      } catch (err) {
        // never cache failures
        if (entries.get(key)?.value === value) entries.delete(key)
        throw err
      } finally {
        // a write happened while loading: drop the possibly stale result
        if (gen !== generation && entries.get(key)?.value === value) entries.delete(key)
      }
    },
    invalidate() {
      generation++
      entries.clear()
    },
  }
}
