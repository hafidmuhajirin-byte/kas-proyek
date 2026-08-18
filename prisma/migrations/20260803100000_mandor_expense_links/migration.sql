-- AlterTable
ALTER TABLE `Transaction`
  ADD COLUMN `linkedMandorDisbursementId` VARCHAR(191) NULL,
  ADD COLUMN `linkedContractorAdvanceId` VARCHAR(191) NULL;

-- CreateEnum
CREATE TABLE `MandorExpenseLine` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('MATERIAL', 'LABOR') NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DOUBLE NULL,
    `unit` VARCHAR(191) NULL,
    `workDays` DOUBLE NULL,
    `dailyRate` INTEGER NULL,
    `amount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `MandorExpenseLine_transactionId_idx`(`transactionId`),
    INDEX `MandorExpenseLine_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Transaction_linkedMandorDisbursementId_idx` ON `Transaction`(`linkedMandorDisbursementId`);

-- CreateIndex
CREATE INDEX `Transaction_linkedContractorAdvanceId_idx` ON `Transaction`(`linkedContractorAdvanceId`);

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_linkedMandorDisbursementId_fkey` FOREIGN KEY (`linkedMandorDisbursementId`) REFERENCES `MandorDisbursement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_linkedContractorAdvanceId_fkey` FOREIGN KEY (`linkedContractorAdvanceId`) REFERENCES `ContractorAdvance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorExpenseLine` ADD CONSTRAINT `MandorExpenseLine_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorExpenseLine` ADD CONSTRAINT `MandorExpenseLine_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: tautkan bukti Mandor ke termin pemborong bila proyek hanya punya 1 termin
UPDATE `Transaction` t
INNER JOIN (
  SELECT c.`projectId` AS projectId, MIN(a.`id`) AS advanceId
  FROM `ContractorAdvance` a
  INNER JOIN `Contractor` c ON c.`id` = a.`contractorId`
  GROUP BY c.`projectId`
  HAVING COUNT(*) = 1
) x ON x.projectId = t.`projectId`
SET t.`linkedContractorAdvanceId` = x.advanceId
WHERE t.`isMandorExpense` = true
  AND t.`linkedContractorAdvanceId` IS NULL
  AND t.`linkedMandorDisbursementId` IS NULL;

-- Backfill: bila hanya ada 1 pencairan MandorDisbursement di proyek
UPDATE `Transaction` t
INNER JOIN (
  SELECT `projectId`, MIN(`id`) AS disbursementId
  FROM `MandorDisbursement`
  GROUP BY `projectId`
  HAVING COUNT(*) = 1
) x ON x.`projectId` = t.`projectId`
SET t.`linkedMandorDisbursementId` = x.disbursementId
WHERE t.`isMandorExpense` = true
  AND t.`linkedContractorAdvanceId` IS NULL
  AND t.`linkedMandorDisbursementId` IS NULL;
