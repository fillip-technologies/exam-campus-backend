import type { Db } from './db.js'

export type LinkType = 'NONE' | 'URL' | 'EXAM' | 'CLASS' | 'SERIES' | 'FREE_TEST' | 'CATEGORY' | 'PAGE' | 'ANCHOR'

export interface LinkTriple {
  linkType: LinkType
  linkRef?: string | null
  linkUrl?: string | null
}

/** Site routes for each linkable entity (the frontend router uses the same paths). */
export const paths = {
  exam: (slug: string) => `/exams/${slug}`,
  class: (slug: string) => `/academic/${slug}`,
  enroll: (slug: string) => `/enroll/${slug}`,
  freeTest: (slug: string) => `/free-test/${slug}`,
  category: (slug: string) => `/#exams/${slug}`,
  page: (slug: string) => `/pages/${slug}`,
}

type EntityLinkType = Exclude<LinkType, 'NONE' | 'URL' | 'ANCHOR'>
const entityTypes: EntityLinkType[] = ['EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE']

/**
 * Resolves link triples to hrefs with one query per entity type, however many links a response has.
 *
 *   const links = new LinkResolver(db)
 *   links.add(row1, row2, ...)      // collect every link in the response
 *   await links.load()
 *   links.href(row1)                // "/exams/sbi-po" | "#free-tests" | "https://..." | null
 *
 * `linkRef` holds the target's id. A target that is missing or not PUBLISHED gives null, and the site hides the link.
 */
export class LinkResolver {
  private pending = new Map<EntityLinkType, Set<string>>()
  private resolved = new Map<string, string | null>()

  constructor(private readonly db: Db) {}

  add(...links: (LinkTriple | null | undefined)[]) {
    for (const l of links) {
      if (!l || !l.linkRef || !entityTypes.includes(l.linkType as EntityLinkType)) continue
      const type = l.linkType as EntityLinkType
      if (this.resolved.has(`${type}:${l.linkRef}`)) continue
      if (!this.pending.has(type)) this.pending.set(type, new Set())
      this.pending.get(type)!.add(l.linkRef)
    }
    return this
  }

  async load() {
    const jobs = [...this.pending].map(async ([type, idSet]) => {
      const ids = [...idSet]
      const found = await this.lookup(type, ids)
      for (const id of ids) this.resolved.set(`${type}:${id}`, found.get(id) ?? null)
    })
    this.pending.clear()
    await Promise.all(jobs)
    return this
  }

  href(l: LinkTriple | null | undefined): string | null {
    if (!l) return null
    switch (l.linkType) {
      case 'NONE':
        return null
      case 'URL':
        return l.linkUrl || null
      case 'ANCHOR':
        return l.linkRef ? `#${l.linkRef}` : null
      default: {
        if (!l.linkRef) return null
        const key = `${l.linkType}:${l.linkRef}`
        if (!this.resolved.has(key)) throw new Error(`Link ${key} was not added before load()`)
        return this.resolved.get(key) ?? null
      }
    }
  }

  private async lookup(type: EntityLinkType, ids: string[]): Promise<Map<string, string>> {
    const where = { id: { in: ids } }
    const published = { ...where, status: 'PUBLISHED' as const }
    const select = { id: true, slug: true }
    const toMap = (rows: { id: string; slug: string | null }[], toPath: (slug: string) => string) =>
      new Map(rows.filter((r) => r.slug).map((r) => [r.id, toPath(r.slug!)]))

    switch (type) {
      case 'EXAM':
        return toMap(await this.db.exam.findMany({ where: published, select }), paths.exam)
      case 'CLASS':
        return toMap(await this.db.academicClass.findMany({ where: published, select }), paths.class)
      case 'SERIES':
        return toMap(await this.db.testSeries.findMany({ where: published, select }), paths.enroll)
      case 'FREE_TEST':
        return toMap(await this.db.freeTest.findMany({ where: published, select }), paths.freeTest)
      case 'CATEGORY':
        return toMap(await this.db.examCategory.findMany({ where: { ...where, active: true }, select }), paths.category)
      case 'PAGE':
        return toMap(await this.db.page.findMany({ where: published, select }), paths.page)
    }
  }
}
