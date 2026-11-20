-- AlterTable
ALTER TABLE `PreviousYearPaper` ADD COLUMN `durationMinutes` INTEGER NULL,
    ADD COLUMN `heldOn` DATE NULL,
    ADD COLUMN `languages` JSON NULL,
    ADD COLUMN `marks` INTEGER NULL,
    ADD COLUMN `practiceUrl` TEXT NULL,
    ADD COLUMN `questions` INTEGER NULL;
