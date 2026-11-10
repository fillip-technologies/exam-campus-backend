/**
 * Seed: imports today's frontend content (exam-campus-frontend/src/data/* + the copy in the home JSX sections)
 * into the database, so the API starts with exactly what the site shows now.
 *
 *   npm run db:seed            (reads FRONTEND_DIR, default ../exam-campus-frontend)
 *
 * It REPLACES all content tables (menus, home, exams, classes, series, free tests ...). It never touches users,
 * orders or payments, and it refuses to run in production or once any order exists.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- frontend data is untyped JS */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPrisma } from '../../src/lib/db.js'
import { slugify } from '../../src/shared/schemas.js'
import type { Prisma } from '../../src/generated/prisma/client.js'
import { registerFrontendImports } from './frontend-hooks.js'
import { announcement, footer, homeFaqs, homeSections, orgNames, pass, site } from './home-content.js'

try {
  process.loadEnvFile('.env')
} catch {
  // variables come from the environment
}

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production.')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set.')

const frontendDir = path.resolve(process.env.FRONTEND_DIR ?? '../exam-campus-frontend')
const srcDir = path.join(frontendDir, 'src')
if (!existsSync(path.join(srcDir, 'data'))) throw new Error(`Frontend data not found at ${srcDir}/data (set FRONTEND_DIR).`)

registerFrontendImports(srcDir)
const load = async (rel: string): Promise<any> => import(pathToFileURL(path.join(srcDir, rel)).href)

const [navData, competitiveData, pyqData, bannerData, heroData, seriesData, freeData, searchData, examsData, classesData] =
  await Promise.all([
    load('data/nav.js'),
    load('data/competitiveMenu.js'),
    load('data/pyqMenu.js'),
    load('data/banners.js'),
    load('data/heroExplorer.js'),
    load('data/testSeries.js'),
    load('data/freeTests.js'),
    load('data/searchCatalog.js'),
    load('data/exams/index.js'),
    load('data/classes/index.js'),
  ])

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** lucide-react component -> its name ("Landmark"), stored as iconKey. */
const iconKey = (icon: any): string | null => {
  if (!icon) return null
  const name = icon.displayName ?? icon.render?.displayName
  if (!name) throw new Error('Could not read the name of a lucide icon')
  return name
}
const months = (v: string | undefined) => (v ? Number.parseInt(v, 10) : 12)
const json = (v: unknown) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue))
/** "#syllabus" -> ANCHOR "syllabus"; "/exams/x" -> URL; empty -> NONE */
const hrefLink = (href: string | undefined) => {
  if (!href || href === '#') return { linkType: 'NONE' as const }
  if (href.startsWith('#')) return { linkType: 'ANCHOR' as const, linkRef: href.slice(1) }
  return { linkType: 'URL' as const, linkUrl: href }
}
const fileExists = (publicPath: string) => existsSync(path.join(frontendDir, 'public', publicPath))

// Series / free tests whose slug is not the exam's slug.
const examSlugFor: Record<string, string> = { 'upsc-cse-prelims': 'upsc-cse' }
// Free-test filter chip labels (freeTests.js) -> category slug.
const freeFilterCategory: Record<string, string> = { Teaching: 'teaching', SSC: 'ssc', Banking: 'banking', Railway: 'railway', UPSC: 'upsc-psc' }

const db = createPrisma(databaseUrl)

async function main() {
  const orders = await db.order.count()
  if (orders > 0) throw new Error(`Refusing to reseed content: ${orders} orders exist.`)

  await wipeContent()

  // ---- site chrome -------------------------------------------------------
  await db.siteSetting.create({
    data: {
      id: 1,
      siteName: site.siteName,
      tagline: site.tagline,
      logoMarkUrl: site.logoMarkUrl,
      logoWordmarkUrl: site.logoWordmarkUrl,
      headerLoginLabel: site.headerLoginLabel,
      headerCtaLabel: site.headerCtaLabel,
      headerCtaLinkType: 'ANCHOR',
      headerCtaLinkRef: site.headerCtaAnchor,
      searchPlaceholder: site.searchPlaceholder,
      footerTagline: site.footerTagline,
      copyrightText: site.copyrightText,
      developerName: site.developerName,
      developerUrl: site.developerUrl,
      developerLogoUrl: site.developerLogoUrl,
    },
  })
  await db.announcement.create({
    data: {
      text: announcement.text,
      mobileText: announcement.mobileText,
      ctaLabel: announcement.ctaLabel,
      linkType: 'ANCHOR',
      linkRef: announcement.anchor,
      theme: announcement.theme,
    },
  })

  // ---- taxonomy: organisations, categories ------------------------------
  const competitive: any[] = competitiveData.competitiveMenu
  const pyqOnly: any[] = pyqData.pyqMenu.filter((c: any) => !competitive.some((k) => k.id === c.id))
  const seriesCategories: any[] = seriesData.testSeriesCategories
  const hubExams: any[] = examsData.allExams
  const hubClasses: any[] = classesData.allClasses

  const orgKeys = new Set<string>()
  for (const c of [...competitive, ...pyqOnly]) for (const e of c.exams) orgKeys.add(e.org)
  for (const c of seriesCategories) for (const s of c.items) orgKeys.add(s.org)
  for (const t of freeData.freeTests) orgKeys.add(t.org)
  for (const e of hubExams) {
    orgKeys.add(e.org)
    for (const r of e.relatedExams ?? []) orgKeys.add(r.org)
  }
  const orgId = new Map<string, string>()
  for (const key of [...orgKeys].sort()) {
    const logo = `/images/exam-logos/${key}.png`
    const org = await db.examOrganization.create({
      data: { key, name: orgNames[key] ?? key.toUpperCase(), logoUrl: fileExists(logo) ? logo : null },
    })
    orgId.set(key, org.id)
  }

  const shortLabel = Object.fromEntries(Object.entries(freeFilterCategory).map(([label, slug]) => [slug, label]))
  const categoryId = new Map<string, string>()
  let sort = 0
  for (const c of competitive) {
    const row = await db.examCategory.create({
      data: {
        slug: c.id,
        label: c.label,
        shortLabel: shortLabel[c.id] ?? null,
        iconKey: iconKey(c.icon),
        sort: sort++,
        showInCompetitiveMenu: true,
        showInPyqMenu: true,
        showInHomeGrid: true,
        showInFreeTestFilter: c.id in shortLabel,
      },
    })
    categoryId.set(c.id, row.id)
  }
  for (const c of pyqOnly) {
    // JEE & NEET: PYQ menu only (academic entrance, not in Competitive Exams or the home grid)
    const row = await db.examCategory.create({
      data: { slug: c.id, label: c.label, iconKey: iconKey(c.icon), sort: sort++, showInCompetitiveMenu: false, showInPyqMenu: true, showInHomeGrid: false },
    })
    categoryId.set(c.id, row.id)
  }

  // ---- exams -------------------------------------------------------------
  const fullNames = new Map<string, string>()
  for (const e of hubExams) for (const r of e.relatedExams ?? []) fullNames.set(r.slug, r.fullName)
  const hubBySlug = new Map(hubExams.map((e) => [e.slug, e]))

  const examId = new Map<string, string>()
  for (const c of [...competitive, ...pyqOnly]) {
    for (const [i, e] of c.exams.entries()) {
      const hub = hubBySlug.get(e.slug)
      const row = await db.exam.create({
        data: {
          slug: e.slug,
          name: e.name,
          fullName: hub?.fullName ?? fullNames.get(e.slug) ?? null,
          categoryId: categoryId.get(c.id)!,
          orgId: orgId.get(e.org)!,
          status: hub ? 'PUBLISHED' : 'COMING_SOON',
          publishedAt: hub ? new Date() : null,
          menuSort: i,
          aliases: e.slug === 'bihar-stet' ? ['STET'] : undefined,
        },
      })
      examId.set(e.slug, row.id)
    }
  }
  // Exams that only appear as a test series card (RBI Assistant, NIACL Assistant): DRAFT, so they stay out of menus.
  for (const c of seriesCategories) {
    for (const s of c.items) {
      const slug = examSlugFor[s.slug] ?? s.slug
      if (examId.has(slug)) continue
      const row = await db.exam.create({
        data: { slug, name: s.exam, categoryId: categoryId.get(c.id)!, orgId: orgId.get(s.org)!, status: 'DRAFT', menuSort: 100 },
      })
      examId.set(slug, row.id)
    }
  }

  // Exam hub detail (SBI PO today)
  for (const e of hubExams) {
    const id = examId.get(e.slug)!
    await db.exam.update({
      where: { id },
      data: {
        description: e.description,
        statusLabel: e.status?.label ?? null,
        statusTone: e.status?.tone ? (e.status.tone.toUpperCase() as 'INFO' | 'SUCCESS' | 'WARNING') : null,
        eligibilityHighlights: json(e.eligibility?.highlights),
        eligibilityDisclaimer: e.eligibility?.disclaimer ?? null,
        patternSummary: e.examPattern?.summary ?? null,
        patternDisclaimer: e.examPattern?.disclaimer ?? null,
        syllabusOfficialUrl: e.syllabus?.officialUrl ?? null,
        quickInfo: { create: (e.quickInfo ?? []).map((q: any, i: number) => ({ label: q.label, value: q.value, sort: i })) },
        dates: {
          create: (e.importantDates ?? []).map((d: any, i: number) => ({
            event: d.event,
            date: d.date ? new Date(d.date) : null,
            highlight: Boolean(d.highlight),
            sort: i,
          })),
        },
        updates: {
          create: (e.latestUpdates ?? []).map((u: any) => ({
            date: new Date(u.date),
            title: u.title,
            description: u.description || null,
            sourceUrl: u.sourceUrl || null,
            sourceLabel: u.sourceLabel || null,
          })),
        },
        eligibilitySections: {
          create: (e.eligibility?.sections ?? []).map((s: any, i: number) => ({ title: s.title, blocks: s.blocks, sort: i })),
        },
        patternStages: {
          create: (e.examPattern?.stages ?? []).map((st: any, i: number) => ({
            name: st.name,
            description: st.description ?? null,
            negativeMarking: st.negativeMarking ?? null,
            negativeMarkingShort: st.negativeMarkingShort ?? null,
            notes: json(st.notes),
            sort: i,
            sections: {
              create: (st.sections ?? []).map((sec: any, j: number) => ({
                name: sec.name,
                questions: sec.questions ?? null,
                marks: sec.marks ?? null,
                durationMinutes: sec.durationMinutes ?? null,
                negativeMarking: sec.negativeMarking ?? null,
                sort: j,
              })),
            },
          })),
        },
        syllabusStages: {
          create: (e.syllabus?.stages ?? []).map((st: any, i: number) => ({
            name: st.name,
            sort: i,
            subjects: { create: st.subjects.map((s: any, j: number) => ({ name: s.name, topics: s.topics, sort: j })) },
          })),
        },
        papers: {
          create: (e.previousYearPapers ?? []).map((p: any) => ({
            year: p.year,
            stage: p.stage ?? null,
            shift: p.shift ?? null,
            type: p.type ?? null,
            viewUrl: p.viewUrl ?? null,
            downloadUrl: p.downloadUrl ?? null,
          })),
        },
        resources: {
          create: (e.resources ?? []).map((r: any, i: number) => ({
            type: r.type,
            title: r.title,
            description: r.description ?? null,
            ...hrefLink(r.href),
            sort: i,
          })),
        },
        faqs: { create: (e.faqs ?? []).map((f: any, i: number) => ({ scope: 'EXAM' as const, question: f.question, answer: f.answer, sort: i })) },
      },
    })
    for (const [i, r] of (e.relatedExams ?? []).entries()) {
      const relatedId = examId.get(r.slug)
      if (relatedId) await db.examRelation.create({ data: { examId: id, relatedExamId: relatedId, sort: i } })
    }
  }

  // ---- academic classes --------------------------------------------------
  const academicColumns: any[] = navData.academicColumns
  const groupId = new Map<string, string>() // "Classes 6–8" -> id
  const classColumns = academicColumns.filter((c) => /^Class \d/.test(c.title))
  for (const [i, col] of classColumns.entries()) {
    const label = col.title.replace(/^Class /, 'Classes ')
    const row = await db.classGroup.create({
      data: { slug: slugify(label), label, iconKey: iconKey(col.icon), tagline: col.desc, sort: i },
    })
    groupId.set(label, row.id)
  }

  const classId = new Map<string, string>()
  const knownClasses = new Map<string, { name: string; stage: string }>()
  for (const c of hubClasses) {
    knownClasses.set(c.slug, { name: c.name, stage: c.stage })
    for (const r of c.relatedClasses ?? []) knownClasses.set(r.slug, { name: r.name, stage: r.stage })
  }
  const hubClassBySlug = new Map(hubClasses.map((c) => [c.slug, c]))
  for (const [slug, { name, stage }] of [...knownClasses].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    const hub = hubClassBySlug.get(slug)
    const row = await db.academicClass.create({
      data: {
        slug,
        name,
        grade: Number.parseInt(slug.replace(/\D/g, ''), 10),
        groupId: groupId.get(stage)!,
        status: hub ? 'PUBLISHED' : 'COMING_SOON',
        publishedAt: hub ? new Date() : null,
        boards: json(hub?.boards),
        description: hub?.description ?? null,
      },
    })
    classId.set(slug, row.id)
    if (!hub) continue
    await db.academicClass.update({
      where: { id: row.id },
      data: {
        quickInfo: { create: (hub.quickInfo ?? []).map((q: any, i: number) => ({ label: q.label, value: q.value, sort: i })) },
        subjects: {
          create: (hub.subjects ?? []).map((s: any, i: number) => ({ name: s.name, summary: s.summary, testTypes: s.testTypes, topics: s.topics, sort: i })),
        },
        steps: { create: (hub.howItWorks ?? []).map((s: any, i: number) => ({ title: s.title, text: s.text, sort: i })) },
        faqs: { create: (hub.faqs ?? []).map((f: any, i: number) => ({ scope: 'CLASS' as const, question: f.question, answer: f.answer, sort: i })) },
      },
    })
  }

  // ---- test series -------------------------------------------------------
  // Home cards (testSeries.js) come first in `sort`, in the order the home page shows them.
  // An exam with a hub (SBI PO) has no separate card: its primary hub series is the card.
  const seriesIdByCardSlug = new Map<string, string>()
  const cards: any[] = seriesCategories.flatMap((c) => c.items)
  const countOf = (features: any[], label: string) => Number.parseInt(features.find((f) => f.label === label)?.value ?? '0', 10)

  for (const [i, card] of cards.entries()) {
    const slug = examSlugFor[card.slug] ?? card.slug
    const hub = hubBySlug.get(slug)
    const cardFields = {
      stageTag: card.tag ?? null,
      offerLabel: card.offer ?? null,
      posterUrl: card.image ?? null,
      pyqTests: countOf(card.features, 'Previous Year Papers'),
      sort: i,
    }
    if (hub) {
      // merged onto the hub's primary series below
      seriesIdByCardSlug.set(card.slug, `hub:${slug}`)
      ;(hub as any).__card = cardFields
      continue
    }
    const row = await db.testSeries.create({
      data: {
        slug: card.slug,
        examId: examId.get(slug)!,
        title: card.title,
        subtitle: card.subtitle,
        languages: card.language ? [card.language] : undefined,
        validityMonths: months(card.validity),
        price: card.price,
        mrp: card.mrp,
        fullLengthTests: countOf(card.features, 'Full-length Mocks'),
        sectionalTests: countOf(card.features, 'Sectional Tests'),
        topicTests: countOf(card.features, 'Topic-wise Tests'),
        isPrimary: true,
        status: 'PUBLISHED',
        ...cardFields,
      },
    })
    seriesIdByCardSlug.set(card.slug, row.id)
  }

  for (const e of hubExams) {
    for (const [i, s] of (e.testSeries ?? []).entries()) {
      const primary = i === 0
      const card = primary ? (e as any).__card : undefined
      const row = await db.testSeries.create({
        data: {
          slug: s.id,
          examId: examId.get(e.slug)!,
          title: s.title,
          subtitle: s.subtitle ?? null,
          languages: json(s.languages),
          validityMonths: months(s.validity),
          price: s.price,
          mrp: s.originalPrice,
          posterUrl: s.image ?? card?.posterUrl ?? null,
          includes: json(s.includes),
          totalTests: s.totalTests ?? 0,
          fullLengthTests: s.fullLengthTests ?? 0,
          sectionalTests: s.sectionalTests ?? 0,
          topicTests: s.practiceTests ?? 0,
          // the PYQ series' tests are previous year papers; the primary keeps the home card's PYQ count
          pyqTests: /previous-year-papers/.test(s.id) ? (s.totalTests ?? 0) : (card?.pyqTests ?? 0),
          stageTag: card?.stageTag ?? null,
          offerLabel: card?.offerLabel ?? null,
          isPrimary: primary,
          status: 'PUBLISHED',
          sort: card?.sort ?? 100 + i,
        },
      })
      if (primary) {
        for (const [cardSlug, ref] of seriesIdByCardSlug) if (ref === `hub:${e.slug}`) seriesIdByCardSlug.set(cardSlug, row.id)
      }
    }
  }

  for (const c of hubClasses) {
    for (const [i, s] of (c.testSeries ?? []).entries()) {
      const total = s.stats?.find((x: any) => x.label === 'Total tests')?.value
      await db.testSeries.create({
        data: {
          slug: s.id,
          classId: classId.get(c.slug)!,
          title: s.title,
          subtitle: s.subtitle ?? null,
          validityMonths: months(s.validity),
          price: s.price,
          mrp: s.originalPrice,
          includes: json(s.includes),
          extraStats: json(s.stats),
          totalTests: typeof total === 'number' ? total : 0,
          isPrimary: i === 0,
          status: 'PUBLISHED',
          sort: 200 + i,
        },
      })
    }
  }

  // ---- free tests --------------------------------------------------------
  const freeSlug = (startUrl: string) => startUrl.replace(/^\/free-test\//, '')
  const freeTestIds = new Set<string>()
  for (const e of hubExams) {
    for (const t of e.freeTests ?? []) {
      const slug = freeSlug(t.startUrl)
      const homeIndex = freeData.freeTests.findIndex((h: any) => h.slug === slug)
      await db.freeTest.create({
        data: {
          slug,
          examId: examId.get(e.slug)!,
          title: t.title,
          questions: t.questions,
          durationMinutes: t.durationMinutes,
          testKindLabel: t.type,
          status: 'PUBLISHED',
          sort: homeIndex === -1 ? 100 : homeIndex,
        },
      })
      freeTestIds.add(slug)
    }
  }
  for (const c of hubClasses) {
    for (const t of c.freeTests ?? []) {
      const slug = freeSlug(t.startUrl)
      await db.freeTest.create({
        data: {
          slug,
          classId: classId.get(c.slug)!,
          title: t.title,
          questions: t.questions,
          durationMinutes: t.durationMinutes,
          testKindLabel: t.type,
          status: 'PUBLISHED',
          sort: 200,
        },
      })
      freeTestIds.add(slug)
    }
  }
  for (const [i, t] of freeData.freeTests.entries()) {
    if (freeTestIds.has(t.slug)) continue
    const exam = examSlugFor[t.slug] ?? t.slug
    await db.freeTest.create({
      data: {
        slug: t.slug,
        examId: examId.get(exam)!,
        title: `${t.exam} Free Mock Test`,
        questions: t.questions,
        durationMinutes: t.minutes,
        testKindLabel: 'Full-length mock test',
        status: 'PUBLISHED',
        sort: i,
      },
    })
  }

  await db.pass.create({ data: { ...pass, benefits: pass.benefits } })

  // ---- hero: banners, category chips, series tabs ------------------------
  for (const [i, b] of bannerData.heroBanners.entries()) {
    const target = examId.get(b.slug)
    await db.banner.create({
      data: { imageUrl: b.src, alt: b.alt, sort: i, ...(target ? { linkType: 'EXAM', linkRef: target } : { linkType: 'ANCHOR', linkRef: 'test-series' }) },
    })
  }

  for (const [i, h] of heroData.heroCategories.entries()) {
    await db.heroCategory.create({
      data: {
        key: h.id,
        label: h.label,
        iconKey: iconKey(h.icon),
        sort: i,
        categories: { create: h.seriesIds.map((slug: string) => ({ examCategoryId: categoryId.get(slug)! })) },
      },
    })
  }

  // heroExplorer.js keeps the curated slug lists private; they are copied here.
  const curated: Record<string, string[]> = {
    popular: ['sbi-po', 'ssc-cgl', 'bpsc-tre', 'ctet', 'rrb-ntpc', 'upsc-cse-prelims', 'nda', 'ibps-po', 'ibps-clerk', 'sbi-clerk'],
    latest: ['bpsc-tre', 'ctet', 'ssc-cgl', 'rrb-ntpc', 'sbi-po', 'nda'],
  }
  const tabRule: Record<string, 'CURATED' | 'ALL' | 'HAS_SECTIONAL' | 'HAS_TOPIC' | 'HAS_PYQ' | 'HAS_FREE_TEST'> = {
    popular: 'CURATED',
    latest: 'CURATED',
    'exam-wise': 'ALL',
    sectional: 'HAS_SECTIONAL',
    'topic-wise': 'HAS_TOPIC',
    pyq: 'HAS_PYQ',
    free: 'HAS_FREE_TEST',
  }
  for (const [i, t] of heroData.seriesTabs.entries()) {
    const rule = tabRule[t.id]
    if (!rule) throw new Error(`No rule mapped for series tab "${t.id}"`)
    await db.seriesTab.create({
      data: {
        key: t.id,
        label: t.label,
        iconKey: iconKey(t.icon),
        heading: t.heading,
        limit: t.limit ?? null,
        rule,
        sort: i,
        items: {
          create: (curated[t.id] ?? []).map((slug, j) => {
            const seriesId = seriesIdByCardSlug.get(slug)
            if (!seriesId) throw new Error(`Curated series "${slug}" not found`)
            return { seriesId, sort: j }
          }),
        },
      },
    })
  }

  // ---- home sections + home FAQ -----------------------------------------
  for (const [i, s] of homeSections.entries()) {
    await db.homeSection.create({
      data: {
        key: s.key,
        type: s.type,
        anchorId: s.anchorId ?? null,
        eyebrow: s.eyebrow ?? null,
        title: s.title ?? null,
        subtitle: s.subtitle ?? null,
        body: s.body ?? null,
        config: (s.config ?? {}) as Prisma.InputJsonValue,
        sort: i,
        items: {
          create: (s.items ?? []).map((it, j) => ({
            role: it.role ?? 'ITEM',
            iconKey: it.iconKey ?? null,
            title: it.title ?? null,
            text: it.text ?? null,
            ...(it.anchor ? { linkType: 'ANCHOR' as const, linkRef: it.anchor } : {}),
            sort: j,
          })),
        },
      },
    })
  }
  await db.faq.createMany({ data: homeFaqs.map((f, i) => ({ scope: 'HOME' as const, question: f.q, answer: f.a, sort: i })) })

  // ---- navbar ------------------------------------------------------------
  const navLinkFor = (to: string | undefined) => {
    if (!to) return { linkType: 'NONE' as const }
    const exam = to.match(/^\/exams\/(.+)$/)?.[1]
    if (exam && examId.has(exam)) return { linkType: 'EXAM' as const, linkRef: examId.get(exam)! }
    const cls = to.match(/^\/academic\/(.+)$/)?.[1]
    if (cls && classId.has(cls)) return { linkType: 'CLASS' as const, linkRef: classId.get(cls)! }
    return hrefLink(to)
  }
  for (const [i, n] of navData.navItems.entries()) {
    const isCategoryMega = n.id === 'competitive' || n.id === 'pyq'
    const item = await db.navItem.create({
      data: {
        key: n.id,
        label: n.label,
        ariaLabel: n.ariaLabel ?? null,
        type: n.type === 'mega' ? 'MEGA' : n.type === 'dropdown' ? 'DROPDOWN' : 'LINK',
        badge: n.badge ?? null,
        iconKey: iconKey(n.icon),
        wide: Boolean(n.wide),
        footerLabel: n.footer ?? null,
        contentSource: isCategoryMega ? 'EXAM_CATEGORIES' : 'MANUAL',
        categoryMenu: n.id === 'competitive' ? 'COMPETITIVE' : n.id === 'pyq' ? 'PYQ' : null,
        activePathPrefix: n.id === 'academic' ? '/academic' : n.id === 'competitive' ? '/exams' : null,
        sort: i,
        links: {
          create: (n.items ?? []).map((l: any, j: number) => ({ label: l.title, description: l.desc ?? null, iconKey: iconKey(l.icon), linkType: 'NONE' as const, sort: j })),
        },
      },
    })
    if (n.id !== 'academic') continue
    for (const [j, col] of academicColumns.entries()) {
      await db.navColumn.create({
        data: {
          navItemId: item.id,
          title: col.title,
          description: col.desc ?? null,
          iconKey: iconKey(col.icon),
          sort: j,
          links: {
            create: col.links.map((l: any, k: number) =>
              typeof l === 'string' ? { label: l, linkType: 'NONE' as const, sort: k } : { label: l.label, ...navLinkFor(l.to), sort: k },
            ),
          },
        },
      })
    }
  }

  // ---- footer, social, search -------------------------------------------
  for (const [i, col] of footer.columns.entries()) {
    await db.footerColumn.create({
      data: {
        title: col.title,
        sort: i,
        links: {
          create: col.links.map((l, j) => {
            const target = l.exam ? examId.get(slugify(l.exam)) : undefined
            if (l.exam && !target) throw new Error(`Footer exam "${l.exam}" not found`)
            return { label: l.label, sort: j, ...(target ? { linkType: 'EXAM' as const, linkRef: target } : { linkType: 'ANCHOR' as const, linkRef: l.anchor! }) }
          }),
        },
      },
    })
  }
  await db.footerLink.createMany({
    data: footer.legal.map((label, i) => ({ legal: true, label, linkType: 'ANCHOR' as const, linkRef: slugify(label), sort: i })),
  })
  await db.socialLink.createMany({ data: footer.social.map((platform, i) => ({ platform, url: `#${platform.toLowerCase()}`, sort: i })) })
  await db.searchSuggestion.createMany({
    data: [
      ...navData.searchSuggestions.map((label: string, i: number) => ({ kind: 'SUGGESTION' as const, label, sort: i })),
      ...searchData.popularSearches.map((label: string, i: number) => ({ kind: 'POPULAR' as const, label, sort: i })),
    ],
  })
}

/** Deletes every content row (children first). Users, orders, payments, media and audit rows are kept. */
async function wipeContent() {
  await db.$transaction([
    db.seriesTabItem.deleteMany(),
    db.seriesTab.deleteMany(),
    db.heroCategoryLink.deleteMany(),
    db.heroCategory.deleteMany(),
    db.banner.deleteMany(),
    db.sectionItem.deleteMany(),
    db.homeSection.deleteMany(),
    db.faq.deleteMany(),
    db.freeTest.deleteMany(),
    db.testSeries.deleteMany(),
    db.pass.deleteMany(),
    db.examRelation.deleteMany(),
    db.quickInfoItem.deleteMany(),
    db.examDate.deleteMany(),
    db.examUpdate.deleteMany(),
    db.examEligibilitySection.deleteMany(),
    db.examPatternSection.deleteMany(),
    db.examPatternStage.deleteMany(),
    db.examSyllabusSubject.deleteMany(),
    db.examSyllabusStage.deleteMany(),
    db.previousYearPaper.deleteMany(),
    db.examResource.deleteMany(),
    db.exam.deleteMany(),
    db.examOrganization.deleteMany(),
    db.examCategory.deleteMany(),
    db.classSubject.deleteMany(),
    db.howItWorksStep.deleteMany(),
    db.academicClass.deleteMany(),
    db.classGroup.deleteMany(),
    db.navLink.deleteMany(),
    db.navColumn.deleteMany(),
    db.navItem.deleteMany(),
    db.footerLink.deleteMany(),
    db.footerColumn.deleteMany(),
    db.socialLink.deleteMany(),
    db.searchSuggestion.deleteMany(),
    db.announcement.deleteMany(),
    db.siteSetting.deleteMany(),
  ])
}

try {
  await main()
  const counts = {
    exams: await db.exam.count(),
    classes: await db.academicClass.count(),
    series: await db.testSeries.count(),
    freeTests: await db.freeTest.count(),
    homeSections: await db.homeSection.count(),
    navItems: await db.navItem.count(),
    faqs: await db.faq.count(),
  }
  console.log('Seeded from', frontendDir, counts)
} finally {
  await db.$disconnect()
}
