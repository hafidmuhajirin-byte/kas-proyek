-- AlterTable
ALTER TABLE `Project` ADD COLUMN `driveProjectFolderId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ProjectSitePhoto` (
    `id` VARCHAR(191) NOT NULL,
    `takenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `caption` TEXT NULL,
    `photoUrl` TEXT NOT NULL,
    `driveFileId` VARCHAR(191) NULL,
    `driveWebViewLink` TEXT NULL,
    `driveSyncError` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `ProjectSitePhoto_projectId_takenAt_idx`(`projectId`, `takenAt`),
    INDEX `ProjectSitePhoto_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectSitePhoto` ADD CONSTRAINT `ProjectSitePhoto_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectSitePhoto` ADD CONSTRAINT `ProjectSitePhoto_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
