-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `laborPeriodStart` DATETIME(3) NULL,
    ADD COLUMN `laborPeriodEnd` DATETIME(3) NULL,
    ADD COLUMN `laborWeekIndex` INTEGER NULL;
