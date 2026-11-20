-- AlterTable
ALTER TABLE `MediaAsset` ADD COLUMN `storage` VARCHAR(20) NOT NULL DEFAULT 'local';

-- Files uploaded before this column existed: Cloudinary URLs belong to the cloudinary driver.
UPDATE `MediaAsset` SET `storage` = 'cloudinary' WHERE `url` LIKE 'https://res.cloudinary.com/%';
