-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `isSplitParent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `splitParentId` VARCHAR(191) NULL,
    ADD COLUMN `splitIndex` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Transaction_splitParentId_idx` ON `Transaction`(`splitParentId`);

-- CreateIndex
CREATE INDEX `Transaction_isSplitParent_idx` ON `Transaction`(`isSplitParent`);

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_splitParentId_fkey` FOREIGN KEY (`splitParentId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
