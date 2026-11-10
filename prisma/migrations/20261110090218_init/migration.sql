-- CreateTable
CREATE TABLE `SiteSetting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `siteName` VARCHAR(191) NOT NULL DEFAULT 'ExamCampus',
    `tagline` VARCHAR(191) NULL,
    `logoMarkUrl` TEXT NULL,
    `logoWordmarkUrl` TEXT NULL,
    `faviconUrl` TEXT NULL,
    `headerLoginLabel` VARCHAR(191) NOT NULL DEFAULT 'Login',
    `headerCtaLabel` VARCHAR(191) NOT NULL DEFAULT 'Start Learning',
    `headerCtaLinkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'ANCHOR',
    `headerCtaLinkRef` VARCHAR(191) NULL,
    `headerCtaLinkUrl` TEXT NULL,
    `searchPlaceholder` VARCHAR(500) NULL,
    `footerTagline` VARCHAR(500) NULL,
    `copyrightText` VARCHAR(500) NULL,
    `developerName` VARCHAR(191) NULL,
    `developerUrl` TEXT NULL,
    `developerLogoUrl` TEXT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `seoTitleTemplate` VARCHAR(191) NULL,
    `defaultMetaDescription` VARCHAR(500) NULL,
    `defaultOgImageUrl` TEXT NULL,
    `analyticsId` VARCHAR(191) NULL,
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `mobileText` VARCHAR(191) NULL,
    `ctaLabel` VARCHAR(191) NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'NONE',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `theme` VARCHAR(191) NULL,
    `dismissible` BOOLEAN NOT NULL DEFAULT false,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NavItem` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `ariaLabel` VARCHAR(191) NULL,
    `type` ENUM('MEGA', 'DROPDOWN', 'LINK') NOT NULL,
    `badge` VARCHAR(191) NULL,
    `iconKey` VARCHAR(191) NULL,
    `wide` BOOLEAN NOT NULL DEFAULT false,
    `footerLabel` VARCHAR(191) NULL,
    `footerLinkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'NONE',
    `footerLinkRef` VARCHAR(191) NULL,
    `footerLinkUrl` TEXT NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'NONE',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `contentSource` ENUM('MANUAL', 'EXAM_CATEGORIES') NOT NULL DEFAULT 'MANUAL',
    `categoryMenu` ENUM('COMPETITIVE', 'PYQ') NULL,
    `activePathPrefix` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NavItem_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NavColumn` (
    `id` VARCHAR(191) NOT NULL,
    `navItemId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `iconKey` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `NavColumn_navItemId_idx`(`navItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NavLink` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `navItemId` VARCHAR(191) NULL,
    `columnId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `iconKey` VARCHAR(191) NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'URL',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `NavLink_navItemId_idx`(`navItemId`),
    INDEX `NavLink_columnId_idx`(`columnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FooterColumn` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FooterLink` (
    `id` VARCHAR(191) NOT NULL,
    `columnId` VARCHAR(191) NULL,
    `legal` BOOLEAN NOT NULL DEFAULT false,
    `label` VARCHAR(191) NOT NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'URL',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `FooterLink_columnId_idx`(`columnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialLink` (
    `id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SearchSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('SUGGESTION', 'POPULAR') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamOrganization` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logoUrl` TEXT NULL,

    UNIQUE INDEX `ExamOrganization_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamCategory` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `shortLabel` VARCHAR(191) NULL,
    `iconKey` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `showInCompetitiveMenu` BOOLEAN NOT NULL DEFAULT true,
    `showInPyqMenu` BOOLEAN NOT NULL DEFAULT true,
    `showInHomeGrid` BOOLEAN NOT NULL DEFAULT true,
    `showInFreeTestFilter` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `ExamCategory_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassGroup` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `iconKey` VARCHAR(191) NULL,
    `tagline` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ClassGroup_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroCategory` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `iconKey` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `HeroCategory_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroCategoryLink` (
    `heroCategoryId` VARCHAR(191) NOT NULL,
    `examCategoryId` VARCHAR(191) NOT NULL,

    INDEX `HeroCategoryLink_examCategoryId_idx`(`examCategoryId`),
    PRIMARY KEY (`heroCategoryId`, `examCategoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exam` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(500) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `statusLabel` VARCHAR(191) NULL,
    `statusTone` ENUM('INFO', 'SUCCESS', 'WARNING') NULL,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `menuSort` INTEGER NOT NULL DEFAULT 0,
    `aliases` JSON NULL,
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `ogImageUrl` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `eligibilityHighlights` JSON NULL,
    `eligibilityDisclaimer` TEXT NULL,
    `patternSummary` TEXT NULL,
    `patternDisclaimer` TEXT NULL,
    `syllabusOfficialUrl` TEXT NULL,

    UNIQUE INDEX `Exam_slug_key`(`slug`),
    INDEX `Exam_categoryId_menuSort_idx`(`categoryId`, `menuSort`),
    INDEX `Exam_orgId_idx`(`orgId`),
    INDEX `Exam_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamRelation` (
    `examId` VARCHAR(191) NOT NULL,
    `relatedExamId` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamRelation_relatedExamId_idx`(`relatedExamId`),
    PRIMARY KEY (`examId`, `relatedExamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuickInfoItem` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `value` VARCHAR(500) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuickInfoItem_examId_idx`(`examId`),
    INDEX `QuickInfoItem_classId_idx`(`classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamDate` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `date` DATE NULL,
    `highlight` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamDate_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamUpdate` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `sourceUrl` TEXT NULL,
    `sourceLabel` VARCHAR(191) NULL,

    INDEX `ExamUpdate_examId_date_idx`(`examId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamEligibilitySection` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `blocks` JSON NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamEligibilitySection_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamPatternStage` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `negativeMarking` VARCHAR(500) NULL,
    `negativeMarkingShort` VARCHAR(191) NULL,
    `notes` JSON NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamPatternStage_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamPatternSection` (
    `id` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `questions` INTEGER NULL,
    `marks` INTEGER NULL,
    `durationMinutes` INTEGER NULL,
    `negativeMarking` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamPatternSection_stageId_idx`(`stageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamSyllabusStage` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamSyllabusStage_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamSyllabusSubject` (
    `id` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `topics` JSON NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamSyllabusSubject_stageId_idx`(`stageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreviousYearPaper` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `stage` VARCHAR(191) NULL,
    `shift` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `viewUrl` TEXT NULL,
    `downloadUrl` TEXT NULL,
    `testId` VARCHAR(191) NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `PreviousYearPaper_examId_year_idx`(`examId`, `year`),
    INDEX `PreviousYearPaper_testId_idx`(`testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamResource` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'URL',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ExamResource_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcademicClass` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `grade` INTEGER NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `boards` JSON NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `ogImageUrl` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcademicClass_slug_key`(`slug`),
    INDEX `AcademicClass_groupId_grade_idx`(`groupId`, `grade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassSubject` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `testTypes` JSON NULL,
    `topics` JSON NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `ClassSubject_classId_idx`(`classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HowItWorksStep` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `text` TEXT NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `HowItWorksStep_classId_idx`(`classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestSeries` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `title` VARCHAR(500) NOT NULL,
    `subtitle` VARCHAR(500) NULL,
    `stageTag` VARCHAR(191) NULL,
    `languages` JSON NULL,
    `validityMonths` INTEGER NOT NULL DEFAULT 12,
    `price` INTEGER NOT NULL,
    `mrp` INTEGER NOT NULL,
    `offerLabel` VARCHAR(191) NULL,
    `posterUrl` TEXT NULL,
    `includes` JSON NULL,
    `extraStats` JSON NULL,
    `totalTests` INTEGER NOT NULL DEFAULT 0,
    `fullLengthTests` INTEGER NOT NULL DEFAULT 0,
    `sectionalTests` INTEGER NOT NULL DEFAULT 0,
    `topicTests` INTEGER NOT NULL DEFAULT 0,
    `pyqTests` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TestSeries_slug_key`(`slug`),
    INDEX `TestSeries_examId_sort_idx`(`examId`, `sort`),
    INDEX `TestSeries_classId_sort_idx`(`classId`, `sort`),
    INDEX `TestSeries_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeriesTab` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `iconKey` VARCHAR(191) NULL,
    `heading` VARCHAR(191) NOT NULL,
    `limit` INTEGER NULL,
    `rule` ENUM('CURATED', 'ALL', 'HAS_SECTIONAL', 'HAS_TOPIC', 'HAS_PYQ', 'HAS_FREE_TEST') NOT NULL DEFAULT 'ALL',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `SeriesTab_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeriesTabItem` (
    `tabId` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `SeriesTabItem_seriesId_idx`(`seriesId`),
    PRIMARY KEY (`tabId`, `seriesId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreeTest` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `title` VARCHAR(500) NOT NULL,
    `questions` INTEGER NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `testKindLabel` VARCHAR(191) NULL,
    `highlights` JSON NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `testId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `FreeTest_slug_key`(`slug`),
    INDEX `FreeTest_examId_idx`(`examId`),
    INDEX `FreeTest_classId_idx`(`classId`),
    INDEX `FreeTest_testId_idx`(`testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pass` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `validityMonths` INTEGER NOT NULL,
    `price` INTEGER NOT NULL,
    `mrp` INTEGER NOT NULL,
    `benefits` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Pass_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeSection` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `type` ENUM('HERO', 'WHY_POINTS', 'EXAM_CATEGORIES', 'PASS', 'FREE_TESTS', 'EXAM_EXPERIENCE', 'MOBILE_APP', 'FAQ', 'FINAL_CTA', 'RICH_TEXT', 'BANNER_STRIP', 'CUSTOM_BLOCK', 'COLLECTION') NOT NULL,
    `anchorId` VARCHAR(191) NULL,
    `eyebrow` VARCHAR(191) NULL,
    `title` VARCHAR(500) NULL,
    `subtitle` TEXT NULL,
    `body` TEXT NULL,
    `config` JSON NULL,
    `blockTypeKey` VARCHAR(191) NULL,
    `collectionKey` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `publishAt` DATETIME(3) NULL,
    `unpublishAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HomeSection_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SectionItem` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `role` ENUM('ITEM', 'CTA_PRIMARY', 'CTA_SECONDARY') NOT NULL DEFAULT 'ITEM',
    `iconKey` VARCHAR(191) NULL,
    `title` VARCHAR(500) NULL,
    `text` TEXT NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'NONE',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `SectionItem_sectionId_role_sort_idx`(`sectionId`, `role`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `placement` ENUM('HERO', 'STRIP') NOT NULL DEFAULT 'HERO',
    `imageUrl` TEXT NOT NULL,
    `mobileImageUrl` TEXT NULL,
    `alt` VARCHAR(500) NOT NULL,
    `linkType` ENUM('NONE', 'URL', 'EXAM', 'CLASS', 'SERIES', 'FREE_TEST', 'CATEGORY', 'PAGE', 'ANCHOR') NOT NULL DEFAULT 'NONE',
    `linkRef` VARCHAR(191) NULL,
    `linkUrl` TEXT NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Banner_placement_active_sort_idx`(`placement`, `active`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faq` (
    `id` VARCHAR(191) NOT NULL,
    `scope` ENUM('HOME', 'EXAM', 'CLASS') NOT NULL,
    `examId` VARCHAR(191) NULL,
    `classId` VARCHAR(191) NULL,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Faq_scope_sort_idx`(`scope`, `sort`),
    INDEX `Faq_examId_idx`(`examId`),
    INDEX `Faq_classId_idx`(`classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaitlistEntry` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'app',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WaitlistEntry_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactMessage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `subject` VARCHAR(500) NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactMessage_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('STUDENT', 'SUPPORT', 'EDITOR', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'STUDENT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerifiedAt` DATETIME(3) NULL,
    `mobileVerifiedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_mobile_key`(`mobile`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(512) NULL,
    `ip` VARCHAR(45) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `purpose` ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD') NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpCode_identifier_purpose_idx`(`identifier`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('PERCENT', 'FLAT') NOT NULL,
    `value` INTEGER NOT NULL,
    `maxUses` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productType` ENUM('SERIES', 'PASS') NOT NULL,
    `seriesId` VARCHAR(191) NULL,
    `passId` VARCHAR(191) NULL,
    `couponId` VARCHAR(191) NULL,
    `productTitle` VARCHAR(500) NOT NULL,
    `mrpPaise` INTEGER NOT NULL,
    `discountPaise` INTEGER NOT NULL DEFAULT 0,
    `taxPaise` INTEGER NOT NULL DEFAULT 0,
    `amountPaise` INTEGER NOT NULL,
    `status` ENUM('CREATED', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    `providerOrderId` VARCHAR(191) NULL,
    `failureReason` VARCHAR(500) NULL,
    `invoiceNo` VARCHAR(191) NULL,
    `billingName` VARCHAR(191) NULL,
    `billingEmail` VARCHAR(191) NULL,
    `billingState` VARCHAR(191) NULL,
    `gstin` VARCHAR(15) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `Order_providerOrderId_key`(`providerOrderId`),
    UNIQUE INDEX `Order_invoiceNo_key`(`invoiceNo`),
    INDEX `Order_userId_idx`(`userId`),
    INDEX `Order_seriesId_idx`(`seriesId`),
    INDEX `Order_passId_idx`(`passId`),
    INDEX `Order_couponId_idx`(`couponId`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'razorpay',
    `providerPaymentId` VARCHAR(191) NULL,
    `amountPaise` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_providerPaymentId_key`(`providerPaymentId`),
    INDEX `Payment_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'razorpay',
    `eventId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookEvent_processedAt_idx`(`processedAt`),
    UNIQUE INDEX `WebhookEvent_provider_eventId_key`(`provider`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enrollment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productType` ENUM('SERIES', 'PASS') NOT NULL,
    `seriesId` VARCHAR(191) NULL,
    `passId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `grantedById` VARCHAR(191) NULL,

    UNIQUE INDEX `Enrollment_orderId_key`(`orderId`),
    INDEX `Enrollment_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `Enrollment_seriesId_idx`(`seriesId`),
    INDEX `Enrollment_passId_idx`(`passId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Test` (
    `id` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NULL,
    `title` VARCHAR(500) NOT NULL,
    `kind` ENUM('FULL_LENGTH', 'SECTIONAL', 'TOPIC', 'PYQ', 'CHAPTER', 'UNIT', 'FREE') NOT NULL,
    `language` JSON NULL,
    `durationMinutes` INTEGER NOT NULL,
    `totalMarks` INTEGER NOT NULL,
    `instructions` TEXT NULL,
    `isFree` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Test_seriesId_sort_idx`(`seriesId`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestSection` (
    `id` VARCHAR(191) NOT NULL,
    `testId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `TestSection_testId_idx`(`testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('MCQ_SINGLE', 'MCQ_MULTI', 'NUMERIC', 'DESCRIPTIVE') NOT NULL DEFAULT 'MCQ_SINGLE',
    `body` JSON NOT NULL,
    `explanation` JSON NULL,
    `subject` VARCHAR(191) NULL,
    `topic` VARCHAR(191) NULL,
    `difficulty` INTEGER NULL,
    `numericAnswer` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Question_subject_topic_idx`(`subject`, `topic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionOption` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `body` JSON NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuestionOption_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestQuestion` (
    `testId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NULL,
    `marks` DECIMAL(65, 30) NOT NULL DEFAULT 1,
    `negativeMarks` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `TestQuestion_questionId_idx`(`questionId`),
    INDEX `TestQuestion_sectionId_idx`(`sectionId`),
    PRIMARY KEY (`testId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `testId` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `score` DECIMAL(65, 30) NULL,
    `summary` JSON NULL,

    INDEX `Attempt_userId_testId_idx`(`userId`, `testId`),
    INDEX `Attempt_testId_idx`(`testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttemptAnswer` (
    `attemptId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `selected` JSON NULL,
    `markedReview` BOOLEAN NOT NULL DEFAULT false,
    `timeSpentSec` INTEGER NOT NULL DEFAULT 0,

    INDEX `AttemptAnswer_questionId_idx`(`questionId`),
    PRIMARY KEY (`attemptId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(512) NOT NULL,
    `url` TEXT NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `alt` VARCHAR(500) NULL,
    `folder` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MediaAsset_key_key`(`key`),
    INDEX `MediaAsset_folder_idx`(`folder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `diff` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentRevision` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContentRevision_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlugRedirect` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `oldSlug` VARCHAR(191) NOT NULL,
    `newSlug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SlugRedirect_entityType_oldSlug_key`(`entityType`, `oldSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomFieldDef` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'LONG_TEXT', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'URL', 'IMAGE', 'SELECT', 'MULTI_SELECT', 'LIST', 'KEY_VALUE', 'LINK') NOT NULL,
    `options` JSON NULL,
    `helpText` VARCHAR(500) NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `groupName` VARCHAR(191) NULL,
    `showOnSite` BOOLEAN NOT NULL DEFAULT true,
    `filterable` BOOLEAN NOT NULL DEFAULT false,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `deprecated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomFieldDef_entityType_key_key`(`entityType`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockType` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `layout` VARCHAR(191) NOT NULL,
    `fields` JSON NOT NULL,
    `iconKey` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `BlockType_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentBlock` (
    `id` VARCHAR(191) NOT NULL,
    `ownerType` ENUM('EXAM', 'CLASS', 'SERIES', 'PAGE') NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `blockTypeKey` VARCHAR(191) NOT NULL,
    `anchorId` VARCHAR(191) NULL,
    `title` VARCHAR(500) NULL,
    `data` JSON NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `publishAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentBlock_ownerType_ownerId_sort_idx`(`ownerType`, `ownerId`, `sort`),
    INDEX `ContentBlock_blockTypeKey_idx`(`blockTypeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Collection` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `fields` JSON NOT NULL,
    `listLayout` VARCHAR(191) NULL,
    `hasPage` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Collection_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionEntry` (
    `id` VARCHAR(191) NOT NULL,
    `collectionId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NULL,
    `title` VARCHAR(500) NOT NULL,
    `data` JSON NOT NULL,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CollectionEntry_collectionId_status_sort_idx`(`collectionId`, `status`, `sort`),
    UNIQUE INDEX `CollectionEntry_collectionId_slug_key`(`collectionId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettingEntry` (
    `id` VARCHAR(191) NOT NULL,
    `groupName` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SettingEntry_groupName_key_key`(`groupName`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NavColumn` ADD CONSTRAINT `NavColumn_navItemId_fkey` FOREIGN KEY (`navItemId`) REFERENCES `NavItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NavLink` ADD CONSTRAINT `NavLink_navItemId_fkey` FOREIGN KEY (`navItemId`) REFERENCES `NavItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NavLink` ADD CONSTRAINT `NavLink_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `NavColumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FooterLink` ADD CONSTRAINT `FooterLink_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `FooterColumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroCategoryLink` ADD CONSTRAINT `HeroCategoryLink_heroCategoryId_fkey` FOREIGN KEY (`heroCategoryId`) REFERENCES `HeroCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroCategoryLink` ADD CONSTRAINT `HeroCategoryLink_examCategoryId_fkey` FOREIGN KEY (`examCategoryId`) REFERENCES `ExamCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exam` ADD CONSTRAINT `Exam_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExamCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exam` ADD CONSTRAINT `Exam_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `ExamOrganization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamRelation` ADD CONSTRAINT `ExamRelation_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamRelation` ADD CONSTRAINT `ExamRelation_relatedExamId_fkey` FOREIGN KEY (`relatedExamId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickInfoItem` ADD CONSTRAINT `QuickInfoItem_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickInfoItem` ADD CONSTRAINT `QuickInfoItem_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamDate` ADD CONSTRAINT `ExamDate_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamUpdate` ADD CONSTRAINT `ExamUpdate_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamEligibilitySection` ADD CONSTRAINT `ExamEligibilitySection_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamPatternStage` ADD CONSTRAINT `ExamPatternStage_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamPatternSection` ADD CONSTRAINT `ExamPatternSection_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ExamPatternStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSyllabusStage` ADD CONSTRAINT `ExamSyllabusStage_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSyllabusSubject` ADD CONSTRAINT `ExamSyllabusSubject_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ExamSyllabusStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreviousYearPaper` ADD CONSTRAINT `PreviousYearPaper_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreviousYearPaper` ADD CONSTRAINT `PreviousYearPaper_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamResource` ADD CONSTRAINT `ExamResource_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademicClass` ADD CONSTRAINT `AcademicClass_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ClassGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassSubject` ADD CONSTRAINT `ClassSubject_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HowItWorksStep` ADD CONSTRAINT `HowItWorksStep_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestSeries` ADD CONSTRAINT `TestSeries_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestSeries` ADD CONSTRAINT `TestSeries_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesTabItem` ADD CONSTRAINT `SeriesTabItem_tabId_fkey` FOREIGN KEY (`tabId`) REFERENCES `SeriesTab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesTabItem` ADD CONSTRAINT `SeriesTabItem_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `TestSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreeTest` ADD CONSTRAINT `FreeTest_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreeTest` ADD CONSTRAINT `FreeTest_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreeTest` ADD CONSTRAINT `FreeTest_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SectionItem` ADD CONSTRAINT `SectionItem_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `HomeSection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Faq` ADD CONSTRAINT `Faq_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Faq` ADD CONSTRAINT `Faq_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `AcademicClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `TestSeries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_passId_fkey` FOREIGN KEY (`passId`) REFERENCES `Pass`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `TestSeries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_passId_fkey` FOREIGN KEY (`passId`) REFERENCES `Pass`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Test` ADD CONSTRAINT `Test_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `TestSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestSection` ADD CONSTRAINT `TestSection_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOption` ADD CONSTRAINT `QuestionOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestQuestion` ADD CONSTRAINT `TestQuestion_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestQuestion` ADD CONSTRAINT `TestQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestQuestion` ADD CONSTRAINT `TestQuestion_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `TestSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentBlock` ADD CONSTRAINT `ContentBlock_blockTypeKey_fkey` FOREIGN KEY (`blockTypeKey`) REFERENCES `BlockType`(`key`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionEntry` ADD CONSTRAINT `CollectionEntry_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Rules Prisma cannot express (hand-written, keep when regenerating).
-- MySQL rejects CHECK constraints on columns whose foreign key cascades or sets null (error 3823), so only
-- tables whose FKs are RESTRICT get one. The cascading "exactly one owner" rules live in Zod (src/shared/schemas.ts).
-- =====================================================================

ALTER TABLE `SiteSetting` ADD CONSTRAINT `SiteSetting_singleton_chk` CHECK (`id` = 1);

ALTER TABLE `Order` ADD CONSTRAINT `Order_product_chk` CHECK (
  (`productType` = 'SERIES' AND `seriesId` IS NOT NULL AND `passId` IS NULL) OR
  (`productType` = 'PASS'   AND `passId`   IS NOT NULL AND `seriesId` IS NULL)
);
ALTER TABLE `Order` ADD CONSTRAINT `Order_money_chk` CHECK (
  `mrpPaise` >= 0 AND `discountPaise` >= 0 AND `taxPaise` >= 0 AND `amountPaise` >= 0
);

ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_product_chk` CHECK (
  (`productType` = 'SERIES' AND `seriesId` IS NOT NULL AND `passId` IS NULL) OR
  (`productType` = 'PASS'   AND `passId`   IS NOT NULL AND `seriesId` IS NULL)
);
