-- CreateTable
CREATE TABLE `ProjectSiteVideo` (
    `id` VARCHAR(191) NOT NULL,
    `takenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `caption` TEXT NULL,
    `videoUrl` TEXT NOT NULL,
    `sourceName` VARCHAR(255) NOT NULL,
    `durationSec` INTEGER NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `ProjectSiteVideo_projectId_takenAt_idx`(`projectId`, `takenAt`),
    INDEX `ProjectSiteVideo_createdById_idx`(`createdById`),
    UNIQUE INDEX `ProjectSiteVideo_projectId_sourceName_key`(`projectId`, `sourceName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectSiteVideo` ADD CONSTRAINT `ProjectSiteVideo_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectSiteVideo` ADD CONSTRAINT `ProjectSiteVideo_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
