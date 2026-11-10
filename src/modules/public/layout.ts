import type { Db } from '../../lib/db.js'
import { activeNow } from '../../lib/format.js'
import { LinkResolver, paths } from '../../lib/links.js'

const listedExam = { status: { in: ['PUBLISHED' as const, 'COMING_SOON' as const] } }

/** Exam entry inside menus and the home grid. `href` is null until the exam has a published hub page. */
export const menuExam = (e: { slug: string; name: string; status: string; org: { key: string } }) => ({
  name: e.name,
  slug: e.slug,
  org: e.org.key,
  hasPage: e.status === 'PUBLISHED',
  href: e.status === 'PUBLISHED' ? paths.exam(e.slug) : null,
})

/** Categories with their listed exams, ordered for menus. Shared by the nav (competitive / PYQ) and the home grid. */
export async function categoriesWithExams(db: Db, where: { showInCompetitiveMenu?: boolean; showInPyqMenu?: boolean; showInHomeGrid?: boolean }) {
  const rows = await db.examCategory.findMany({
    where: { active: true, ...where },
    orderBy: { sort: 'asc' },
    include: {
      exams: {
        where: listedExam,
        orderBy: [{ menuSort: 'asc' }, { name: 'asc' }],
        select: { slug: true, name: true, status: true, org: { select: { key: true } } },
      },
    },
  })
  return rows.map((c) => ({ id: c.slug, label: c.label, icon: c.iconKey, exams: c.exams.map(menuExam) }))
}

/** GET /public/layout: everything the header and footer need on every page. */
export async function getLayout(db: Db) {
  const [site, announcement, navItems, footerColumns, legal, social, suggestions, competitive, pyq] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: 1 } }),
    db.announcement.findFirst({ where: activeNow(), orderBy: { sort: 'asc' } }),
    db.navItem.findMany({
      where: { visible: true },
      orderBy: { sort: 'asc' },
      include: {
        links: { where: { visible: true }, orderBy: { sort: 'asc' } },
        columns: {
          where: { visible: true },
          orderBy: { sort: 'asc' },
          include: { links: { where: { visible: true }, orderBy: { sort: 'asc' } } },
        },
      },
    }),
    db.footerColumn.findMany({
      where: { visible: true },
      orderBy: { sort: 'asc' },
      include: { links: { where: { visible: true }, orderBy: { sort: 'asc' } } },
    }),
    db.footerLink.findMany({ where: { legal: true, visible: true }, orderBy: { sort: 'asc' } }),
    db.socialLink.findMany({ where: { visible: true }, orderBy: { sort: 'asc' } }),
    db.searchSuggestion.findMany({ orderBy: { sort: 'asc' } }),
    categoriesWithExams(db, { showInCompetitiveMenu: true }),
    categoriesWithExams(db, { showInPyqMenu: true }),
  ])

  const links = new LinkResolver(db)
  if (site) links.add({ linkType: site.headerCtaLinkType, linkRef: site.headerCtaLinkRef, linkUrl: site.headerCtaLinkUrl })
  links.add(announcement)
  for (const n of navItems) {
    links.add(n, { linkType: n.footerLinkType, linkRef: n.footerLinkRef, linkUrl: n.footerLinkUrl }, ...n.links)
    for (const c of n.columns) links.add(...c.links)
  }
  for (const c of footerColumns) links.add(...c.links)
  links.add(...legal)
  await links.load()

  const link = (l: Parameters<typeof links.href>[0], label: string | null | undefined) =>
    label ? { label, href: links.href(l) } : null

  return {
    site: site && {
      siteName: site.siteName,
      tagline: site.tagline,
      logoMarkUrl: site.logoMarkUrl,
      logoWordmarkUrl: site.logoWordmarkUrl,
      faviconUrl: site.faviconUrl,
      header: {
        loginLabel: site.headerLoginLabel,
        cta: link({ linkType: site.headerCtaLinkType, linkRef: site.headerCtaLinkRef, linkUrl: site.headerCtaLinkUrl }, site.headerCtaLabel),
      },
      searchPlaceholder: site.searchPlaceholder,
      footer: {
        tagline: site.footerTagline,
        copyright: site.copyrightText,
        developer: site.developerName ? { name: site.developerName, url: site.developerUrl, logoUrl: site.developerLogoUrl } : null,
      },
      contact: { email: site.contactEmail, phone: site.contactPhone, address: site.address },
      seo: { titleTemplate: site.seoTitleTemplate, description: site.defaultMetaDescription, ogImageUrl: site.defaultOgImageUrl },
      analyticsId: site.analyticsId,
      maintenanceMode: site.maintenanceMode,
    },

    announcement: announcement && {
      id: announcement.id,
      text: announcement.text,
      mobileText: announcement.mobileText,
      cta: link(announcement, announcement.ctaLabel),
      theme: announcement.theme,
      dismissible: announcement.dismissible,
    },

    // Same shape as the frontend's data/nav.js navItems (+ the panel content inline).
    nav: navItems.map((n) => {
      const base = {
        id: n.key,
        label: n.label,
        ariaLabel: n.ariaLabel,
        type: n.type.toLowerCase() as 'mega' | 'dropdown' | 'link',
        badge: n.badge,
        icon: n.iconKey,
        wide: n.wide,
        activePathPrefix: n.activePathPrefix,
        href: n.type === 'LINK' ? links.href(n) : null,
        footer: link({ linkType: n.footerLinkType, linkRef: n.footerLinkRef, linkUrl: n.footerLinkUrl }, n.footerLabel),
      }
      if (n.type === 'DROPDOWN') {
        return { ...base, items: n.links.map((l) => ({ title: l.label, desc: l.description, icon: l.iconKey, href: links.href(l) })) }
      }
      if (n.type === 'MEGA' && n.contentSource === 'EXAM_CATEGORIES') {
        return { ...base, menu: n.categoryMenu, categories: n.categoryMenu === 'PYQ' ? pyq : competitive }
      }
      if (n.type === 'MEGA') {
        return {
          ...base,
          columns: n.columns.map((c) => ({
            title: c.title,
            desc: c.description,
            icon: c.iconKey,
            links: c.links.map((l) => ({ label: l.label, href: links.href(l) })),
          })),
        }
      }
      return base
    }),

    footer: {
      columns: footerColumns.map((c) => ({ title: c.title, links: c.links.map((l) => ({ label: l.label, href: links.href(l) })) })),
      legal: legal.map((l) => ({ label: l.label, href: links.href(l) })),
      social: social.map((s) => ({ platform: s.platform, url: s.url })),
    },

    search: {
      suggestions: suggestions.filter((s) => s.kind === 'SUGGESTION').map((s) => s.label),
      popular: suggestions.filter((s) => s.kind === 'POPULAR').map((s) => s.label),
    },
  }
}
