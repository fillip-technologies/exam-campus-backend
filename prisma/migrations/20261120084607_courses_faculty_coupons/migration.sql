-- AlterTable
ALTER TABLE `Coupon` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `label` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `Exam` ADD COLUMN `demoVideoUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `TestSeries` ADD COLUMN `couponId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Course` (
    `customFields` JSON NULL,
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `redirectUrl` TEXT NULL,
    `title` VARCHAR(500) NOT NULL,
    `subtitle` VARCHAR(500) NULL,
    `mode` ENUM('LIVE', 'RECORDED', 'HYBRID') NOT NULL DEFAULT 'LIVE',
    `languages` JSON NULL,
    `faculty` JSON NULL,
    `startDate` DATE NULL,
    `liveClasses` INTEGER NOT NULL DEFAULT 0,
    `recordedVideos` INTEGER NOT NULL DEFAULT 0,
    `totalTests` INTEGER NOT NULL DEFAULT 0,
    `extraStats` JSON NULL,
    `includes` JSON NULL,
    `images` JSON NULL,
    `demoVideoUrl` TEXT NULL,
    `price` INTEGER NOT NULL,
    `mrp` INTEGER NOT NULL,
    `validityMonths` INTEGER NOT NULL DEFAULT 12,
    `offerLabel` VARCHAR(191) NULL,
    `couponId` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'COMING_SOON', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Course_examId_sort_idx`(`examId`, `sort`),
    INDEX `Course_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faculty` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `experience` VARCHAR(191) NULL,
    `photoUrl` TEXT NULL,
    `demoVideoUrl` TEXT NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Faculty_examId_sort_idx`(`examId`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TestSeries` ADD CONSTRAINT `TestSeries_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Faculty` ADD CONSTRAINT `Faculty_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
