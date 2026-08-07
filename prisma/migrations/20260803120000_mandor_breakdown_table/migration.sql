-- AlterTable MandorExpenseLine
ALTER TABLE `MandorExpenseLine` ADD COLUMN `unitPrice` INTEGER NULL;

-- AlterTable Transaction
ALTER TABLE `Transaction`
  ADD COLUMN `breakdownVendor` VARCHAR(191) NULL,
  ADD COLUMN `breakdownStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `breakdownNote` TEXT NULL;

-- Backfill unitPrice from amount/qty or dailyRate
UPDATE `MandorExpenseLine`
SET `unitPrice` = `dailyRate`
WHERE `kind` = 'LABOR' AND `dailyRate` IS NOT NULL AND `unitPrice` IS NULL;

UPDATE `MandorExpenseLine`
SET `unitPrice` = ROUND(`amount` / `quantity`)
WHERE `quantity` IS NOT NULL AND `quantity` > 0 AND `unitPrice` IS NULL;
