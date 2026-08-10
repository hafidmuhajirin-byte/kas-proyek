-- AlterTable
ALTER TABLE `ProjectSitePhoto` ADD COLUMN `sourceName` VARCHAR(255) NOT NULL DEFAULT '';

-- Backfill unique names for existing rows
UPDATE `ProjectSitePhoto`
SET `sourceName` = CONCAT('legacy-', `id`)
WHERE `sourceName` = '';

-- CreateIndex
CREATE UNIQUE INDEX `ProjectSitePhoto_projectId_sourceName_key` ON `ProjectSitePhoto`(`projectId`, `sourceName`);
