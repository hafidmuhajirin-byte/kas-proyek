-- AlterTable Transaction: flag pembayaran pajak
ALTER TABLE `Transaction` ADD COLUMN `isTaxPayment` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable TaxWithholdingLine: status bayar + bukti + billing
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `status` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID';
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `billingId` VARCHAR(191) NULL;
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `proofUrl` TEXT NULL;
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `paidAt` DATETIME(3) NULL;
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `paymentTransactionId` VARCHAR(191) NULL;
ALTER TABLE `TaxWithholdingLine` ADD COLUMN `paidById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Transaction_isTaxPayment_idx` ON `Transaction`(`isTaxPayment`);
CREATE INDEX `TaxWithholdingLine_projectId_status_idx` ON `TaxWithholdingLine`(`projectId`, `status`);
CREATE INDEX `TaxWithholdingLine_status_idx` ON `TaxWithholdingLine`(`status`);
CREATE UNIQUE INDEX `TaxWithholdingLine_paymentTransactionId_key` ON `TaxWithholdingLine`(`paymentTransactionId`);
CREATE UNIQUE INDEX `TaxWithholdingLine_transactionId_kind_key` ON `TaxWithholdingLine`(`transactionId`, `kind`);

-- AddForeignKey
ALTER TABLE `TaxWithholdingLine` ADD CONSTRAINT `TaxWithholdingLine_paymentTransactionId_fkey` FOREIGN KEY (`paymentTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TaxWithholdingLine` ADD CONSTRAINT `TaxWithholdingLine_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
