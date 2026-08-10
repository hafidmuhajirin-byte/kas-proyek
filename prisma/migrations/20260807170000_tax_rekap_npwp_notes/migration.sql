-- AlterTable
ALTER TABLE `Project` ADD COLUMN `lpjNpwp` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TaxMonthNote` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `TaxMonthNote_projectId_idx`(`projectId`),
    UNIQUE INDEX `TaxMonthNote_projectId_year_month_key`(`projectId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaxMonthNote` ADD CONSTRAINT `TaxMonthNote_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
