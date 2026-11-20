import type { Db } from '../../lib/db.js'
import { activeNow, discountPercent, obj, scheduledNow, strings, validityLabel } from '../../lib/format.js'
import { enrollTarget, LinkResolver, paths } from '../../lib/links.js'
import { getFreeTests } from './freeTests.js'
import { categoriesWithExams } from './layout.js'
import { getExplorerMeta, getSeriesCards } from './series.js'

/**
 * GET /public/home: the visible sections in order, each with its data already joined, so the frontend's
 * HomePage becomes `sections.map(s => registry[s.type](s))`.
 *
 * Every section has: key, type, anchorId, eyebrow, title, subtitle, body, config, items (role ITEM), ctas (CTA roles),
 * plus a type-specific `data` object.
 */
export async function getHome(db: Db) {
  const sections = await db.homeSection.findMany({
    where: { visible: true, ...scheduledNow() },
    orderBy: { sort: 'asc' },
    include: { items: { where: { visible: true }, orderBy: { sort: 'asc' } } },
  })

  const links = new LinkResolver(db)
  for (const s of sections) links.add(...s.items)

  const types = new Set(sections.map((s) => s.type))
  const [hero, grid, pass, freeTests, faqs] = await Promise.all([
    types.has('HERO') ? loadHero(db, links) : null,
    types.has('EXAM_CATEGORIES') ? categoriesWithExams(db, { showInHomeGrid: true }) : null,
    types.has('PASS') ? db.pass.findFirst({ where: { active: true }, orderBy: { price: 'asc' } }) : null,
    types.has('FREE_TESTS') ? getFreeTests(db) : null,
    types.has('FAQ') ? db.faq.findMany({ where: { scope: 'HOME', active: true }, orderBy: { sort: 'asc' } }) : null,
  ])
  await links.load()

  return {
    sections: sections.map((s) => {
      const config = obj(s.config)
      const base = {
        key: s.key,
        type: s.type,
        anchorId: s.anchorId,
        eyebrow: s.eyebrow,
        title: s.title,
        subtitle: s.subtitle,
        body: s.body,
        config,
        items: s.items.filter((i) => i.role === 'ITEM').map((i) => ({ icon: i.iconKey, title: i.title, text: i.text, href: links.href(i) })),
        ctas: s.items
          .filter((i) => i.role !== 'ITEM')
          .map((i) => ({ role: i.role === 'CTA_PRIMARY' ? 'primary' : 'secondary', icon: i.iconKey, label: i.title, text: i.text, href: links.href(i) })),
      }
      switch (s.type) {
        case 'HERO':
          return { ...base, data: hero && { ...hero, banners: hero.banners.map((b) => ({ ...b, href: links.href(b.link) ?? '#test-series', link: undefined })) } }
        case 'EXAM_CATEGORIES': {
          const perCard = typeof config.examsPerCard === 'number' ? config.examsPerCard : 5
          return {
            ...base,
            data: {
              categories: (grid ?? []).map((c) => ({ ...c, exams: c.exams.slice(0, perCard), totalExams: c.exams.length, href: paths.category(c.id) })),
            },
          }
        }
        case 'PASS':
          return {
            ...base,
            data: pass && {
              slug: pass.slug,
              title: pass.title,
              validity: validityLabel(pass.validityMonths),
              validityMonths: pass.validityMonths,
              price: pass.price,
              mrp: pass.mrp,
              discountPercent: discountPercent(pass.price, pass.mrp),
              benefits: strings(pass.benefits),
              href: enrollTarget(pass),
              external: Boolean(pass.redirectUrl),
            },
          }
        case 'FREE_TESTS':
          return { ...base, data: freeTests }
        case 'FAQ':
          return { ...base, data: { faqs: (faqs ?? []).map((f) => ({ q: f.question, a: f.answer })) } }
        default:
          return { ...base, data: null }
      }
    }),
  }
}

async function loadHero(db: Db, links: LinkResolver) {
  const [banners, meta, initial] = await Promise.all([
    db.banner.findMany({ where: { placement: 'HERO', ...activeNow() }, orderBy: { sort: 'asc' } }),
    getExplorerMeta(db),
    getSeriesCards(db, {}),
  ])
  links.add(...banners)
  return {
    banners: banners.map((b) => ({ id: b.id, src: b.imageUrl, mobileSrc: b.mobileImageUrl, alt: b.alt, link: b })),
    ...meta,
    // first tab, all categories: the cards visible before the visitor clicks anything
    initialSeries: initial,
  }
}
