-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `isAdminLpjNota` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Transaction_isAdminLpjNota_idx` ON `Transaction`(`isAdminLpjNota`);
