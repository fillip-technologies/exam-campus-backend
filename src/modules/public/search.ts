import type { Db } from '../../lib/db.js'
import { strings } from '../../lib/format.js'
import { paths } from '../../lib/links.js'

export interface SearchEntry {
  type: 'exam' | 'class' | 'category'
  name: string
  /** Category label shown next to the name ("Banking & Insurance", "Academic") */
  category: string
  slug: string
  /** null for exams/classes without a published page yet */
  href: string | null
  terms: string[]
}

export interface SearchResult extends Omit<SearchEntry, 'terms'> {
  score: number
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .trim()

/**
 * The searchable catalogue is small (a few hundred rows), so it is loaded once into memory and rebuilt when
 * the cache is invalidated (any admin write). Matching in memory handles short words ("PO") and aliases,
 * which MySQL FULLTEXT would not.
 */
export async function buildSearchIndex(db: Db): Promise<SearchEntry[]> {
  const [exams, classes, categories] = await Promise.all([
    db.exam.findMany({
      where: { status: { in: ['PUBLISHED', 'COMING_SOON'] } },
      select: { slug: true, name: true, fullName: true, status: true, aliases: true, category: { select: { label: true, active: true } } },
    }),
    db.academicClass.findMany({
      where: { status: { in: ['PUBLISHED', 'COMING_SOON'] } },
      select: { slug: true, name: true, status: true, group: { select: { label: true } } },
      orderBy: { grade: 'asc' },
    }),
    db.examCategory.findMany({ where: { active: true, showInHomeGrid: true }, select: { slug: true, label: true, shortLabel: true } }),
  ])

  return [
    ...classes.map((c) => ({
      type: 'class' as const,
      name: c.name,
      category: 'Academic',
      slug: c.slug,
      href: c.status === 'PUBLISHED' ? paths.class(c.slug) : null,
      terms: [c.name, c.group.label].map(norm),
    })),
    ...exams
      .filter((e) => e.category.active)
      .map((e) => ({
        type: 'exam' as const,
        name: e.name,
        category: e.category.label,
        slug: e.slug,
        href: e.status === 'PUBLISHED' ? paths.exam(e.slug) : null,
        terms: [e.name, e.fullName ?? '', ...strings(e.aliases)].filter(Boolean).map(norm),
      })),
    ...categories.map((c) => ({
      type: 'category' as const,
      name: `${c.label} (all exams)`,
      category: c.label,
      slug: c.slug,
      href: paths.category(c.slug),
      terms: [c.label, c.shortLabel ?? ''].filter(Boolean).map(norm),
    })),
  ]
}

/** Exact name > name starts with the query > a word starts with it > contains it. */
export function searchIndex(index: SearchEntry[], query: string, limit = 10): SearchResult[] {
  const q = norm(query)
  if (!q) return []
  const scored: SearchResult[] = []
  for (const entry of index) {
    let score = 0
    for (const term of entry.terms) {
      if (term === q) score = Math.max(score, 100)
      else if (term.startsWith(q)) score = Math.max(score, 80)
      else if (term.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 60)
      else if (term.includes(q)) score = Math.max(score, 40)
    }
    if (score === 0) continue
    if (entry.href) score += 5 // prefer things that have a page
    if (entry.type === 'category') score -= 10
    const { terms: _terms, ...rest } = entry
    scored.push({ ...rest, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit)
}
