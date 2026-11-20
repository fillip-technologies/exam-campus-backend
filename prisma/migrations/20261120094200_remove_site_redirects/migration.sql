/*
  Warnings:

  - You are about to drop the column `defaultRedirectUrl` on the `SiteSetting` table. All the data in the column will be lost.
  - You are about to drop the column `enrollRedirectUrl` on the `SiteSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `SiteSetting` DROP COLUMN `defaultRedirectUrl`,
    DROP COLUMN `enrollRedirectUrl`;
