/*
  Warnings:

  - You are about to drop the column `couponId` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `couponId` on the `TestSeries` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Course` DROP FOREIGN KEY `Course_couponId_fkey`;

-- DropForeignKey
ALTER TABLE `TestSeries` DROP FOREIGN KEY `TestSeries_couponId_fkey`;

-- DropIndex
DROP INDEX `Course_couponId_idx` ON `Course`;

-- DropIndex
DROP INDEX `TestSeries_couponId_fkey` ON `TestSeries`;

-- AlterTable
ALTER TABLE `Coupon` ADD COLUMN `allCourses` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `allSeries` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Course` DROP COLUMN `couponId`;

-- AlterTable
ALTER TABLE `TestSeries` DROP COLUMN `couponId`;

-- CreateTable
CREATE TABLE `CouponCourse` (
    `couponId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,

    INDEX `CouponCourse_courseId_idx`(`courseId`),
    PRIMARY KEY (`couponId`, `courseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponSeries` (
    `couponId` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NOT NULL,

    INDEX `CouponSeries_seriesId_idx`(`seriesId`),
    PRIMARY KEY (`couponId`, `seriesId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CouponCourse` ADD CONSTRAINT `CouponCourse_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponCourse` ADD CONSTRAINT `CouponCourse_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponSeries` ADD CONSTRAINT `CouponSeries_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponSeries` ADD CONSTRAINT `CouponSeries_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `TestSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
