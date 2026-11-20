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

/*
 * Redirect links ("for now, send visitors to another site"):
 *   - exams and classes: their own `redirectUrl` replaces the hub page link everywhere (menus, search, cards);
 *   - courses, test series, the pass and free tests: each item's own `redirectUrl`, else our own page.
 *     There is no site-wide fallback: every item has its own link.
 * Empty fields change nothing, so clearing them brings the normal pages back.
 */

type Redirectable = { slug: string; redirectUrl?: string | null }

/** Exam hub link: its redirect link, else /exams/<slug> once published, else null (no page yet). */
export const examTarget = (e: Redirectable & { status: string }) => e.redirectUrl || (e.status === 'PUBLISHED' ? paths.exam(e.slug) : null)
/** Class hub link: same rule as exams. */
export const classTarget = (c: Redirectable & { status: string }) => c.redirectUrl || (c.status === 'PUBLISHED' ? paths.class(c.slug) : null)
/** Enroll / Buy button of a series or the pass. */
export const enrollTarget = (p: Redirectable) => p.redirectUrl || paths.enroll(p.slug)
/** Start button of a free test. */
export const freeTestTarget = (t: Redirectable) => t.redirectUrl || paths.freeTest(t.slug)
/** The redirect a page URL (/enroll/x, /free-test/x) should forward to, or null to show our own page. */
export const pageRedirect = (p: { redirectUrl?: string | null }) => p.redirectUrl || null

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
    const redirectable = { ...select, redirectUrl: true }
    const toMap = <R extends { id: string; slug: string | null }>(rows: R[], toHref: (row: R & { slug: string }) => string | null) =>
      new Map(
        rows
          .filter((r): r is R & { slug: string } => Boolean(r.slug))
          .map((r) => [r.id, toHref(r)] as const)
          .filter((e): e is readonly [string, string] => e[1] !== null),
      )

    switch (type) {
      case 'EXAM':
        return toMap(await this.db.exam.findMany({ where: published, select: { ...redirectable, status: true } }), examTarget)
      case 'CLASS':
        return toMap(await this.db.academicClass.findMany({ where: published, select: { ...redirectable, status: true } }), classTarget)
      case 'SERIES': {
        return toMap(await this.db.testSeries.findMany({ where: published, select: redirectable }), enrollTarget)
      }
      case 'FREE_TEST': {
        return toMap(await this.db.freeTest.findMany({ where: published, select: redirectable }), freeTestTarget)
      }
      case 'CATEGORY':
        return toMap(await this.db.examCategory.findMany({ where: { ...where, active: true }, select }), (r) => paths.category(r.slug))
      case 'PAGE':
        return toMap(await this.db.page.findMany({ where: published, select }), (r) => paths.page(r.slug))
    }
  }
}
