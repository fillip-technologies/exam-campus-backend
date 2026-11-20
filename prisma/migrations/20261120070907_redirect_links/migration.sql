-- AlterTable
ALTER TABLE `AcademicClass` ADD COLUMN `redirectUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `Exam` ADD COLUMN `redirectUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `FreeTest` ADD COLUMN `redirectUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `Pass` ADD COLUMN `redirectUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `SiteSetting` ADD COLUMN `defaultRedirectUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `TestSeries` ADD COLUMN `redirectUrl` TEXT NULL;
