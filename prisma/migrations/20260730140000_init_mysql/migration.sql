-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MANDOR') NOT NULL DEFAULT 'MANDOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `billingMode` ENUM('ON_REQUEST', 'TERMIN_PLAN', 'PAY_AT_END') NOT NULL DEFAULT 'ON_REQUEST',
    `openingBalance` INTEGER NOT NULL DEFAULT 0,
    `contractValue` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `checkPlanning` BOOLEAN NOT NULL DEFAULT false,
    `checkSupervision` BOOLEAN NOT NULL DEFAULT false,
    `checkManagement` BOOLEAN NOT NULL DEFAULT false,
    `checkTax` BOOLEAN NOT NULL DEFAULT false,
    `checkReporting` BOOLEAN NOT NULL DEFAULT false,
    `checkContractor` BOOLEAN NOT NULL DEFAULT false,
    `checkNoRetention` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectAssignment_userId_idx`(`userId`),
    INDEX `ProjectAssignment_projectId_idx`(`projectId`),
    UNIQUE INDEX `ProjectAssignment_userId_projectId_key`(`userId`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandorDisbursement` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `amount` INTEGER NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `proofUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `mandorId` VARCHAR(191) NOT NULL,
    `cashSourceId` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NULL,

    UNIQUE INDEX `MandorDisbursement_transactionId_key`(`transactionId`),
    INDEX `MandorDisbursement_projectId_idx`(`projectId`),
    INDEX `MandorDisbursement_mandorId_idx`(`mandorId`),
    INDEX `MandorDisbursement_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectFund` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('PLANNING', 'SUPERVISION', 'MANAGEMENT', 'TAX', 'REPORTING', 'SAVE') NOT NULL,
    `plannedAmount` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `ProjectFund_projectId_idx`(`projectId`),
    UNIQUE INDEX `ProjectFund_projectId_kind_key`(`projectId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contractor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `agreedAmount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Contractor_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorAdvance` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` INTEGER NOT NULL,
    `fromProjectAmount` INTEGER NOT NULL DEFAULT 0,
    `fromGlobalAmount` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `proofUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contractorId` VARCHAR(191) NOT NULL,
    `cashSourceId` VARCHAR(191) NOT NULL,

    INDEX `ContractorAdvance_contractorId_idx`(`contractorId`),
    INDEX `ContractorAdvance_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorExpense` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` INTEGER NOT NULL,
    `kind` ENUM('MATERIAL', 'WAGES', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `description` TEXT NOT NULL,
    `proofUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contractorId` VARCHAR(191) NOT NULL,

    INDEX `ContractorExpense_contractorId_idx`(`contractorId`),
    INDEX `ContractorExpense_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkItem` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DOUBLE NULL,
    `unit` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `WorkItem_projectId_idx`(`projectId`),
    INDEX `WorkItem_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FundingStage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `percent` INTEGER NOT NULL DEFAULT 0,
    `plannedAmount` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `FundingStage_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashSource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('BANK', 'CASH', 'CLIENT_TRANSFER', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `accountNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `proofUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `fromCashSourceId` VARCHAR(191) NOT NULL,
    `toCashSourceId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `CashTransfer_date_idx`(`date`),
    INDEX `CashTransfer_fromCashSourceId_idx`(`fromCashSourceId`),
    INDEX `CashTransfer_toCashSourceId_idx`(`toCashSourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_type_key`(`name`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `amount` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `proofUrl` TEXT NULL,
    `isOwnerPersonal` BOOLEAN NOT NULL DEFAULT false,
    `isFromGlobalCash` BOOLEAN NOT NULL DEFAULT false,
    `isFeeTransfer` BOOLEAN NOT NULL DEFAULT false,
    `isMandorDisbursement` BOOLEAN NOT NULL DEFAULT false,
    `isMandorExpense` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `cashSourceId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `fundingStageId` VARCHAR(191) NULL,

    INDEX `Transaction_date_idx`(`date`),
    INDEX `Transaction_projectId_idx`(`projectId`),
    INDEX `Transaction_cashSourceId_idx`(`cashSourceId`),
    INDEX `Transaction_type_idx`(`type`),
    INDEX `Transaction_fundingStageId_idx`(`fundingStageId`),
    INDEX `Transaction_isOwnerPersonal_idx`(`isOwnerPersonal`),
    INDEX `Transaction_isFromGlobalCash_idx`(`isFromGlobalCash`),
    INDEX `Transaction_isFeeTransfer_idx`(`isFeeTransfer`),
    INDEX `Transaction_isMandorDisbursement_idx`(`isMandorDisbursement`),
    INDEX `Transaction_isMandorExpense_idx`(`isMandorExpense`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectAssignment` ADD CONSTRAINT `ProjectAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectAssignment` ADD CONSTRAINT `ProjectAssignment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorDisbursement` ADD CONSTRAINT `MandorDisbursement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorDisbursement` ADD CONSTRAINT `MandorDisbursement_mandorId_fkey` FOREIGN KEY (`mandorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorDisbursement` ADD CONSTRAINT `MandorDisbursement_cashSourceId_fkey` FOREIGN KEY (`cashSourceId`) REFERENCES `CashSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandorDisbursement` ADD CONSTRAINT `MandorDisbursement_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectFund` ADD CONSTRAINT `ProjectFund_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contractor` ADD CONSTRAINT `Contractor_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractorAdvance` ADD CONSTRAINT `ContractorAdvance_contractorId_fkey` FOREIGN KEY (`contractorId`) REFERENCES `Contractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractorAdvance` ADD CONSTRAINT `ContractorAdvance_cashSourceId_fkey` FOREIGN KEY (`cashSourceId`) REFERENCES `CashSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractorExpense` ADD CONSTRAINT `ContractorExpense_contractorId_fkey` FOREIGN KEY (`contractorId`) REFERENCES `Contractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkItem` ADD CONSTRAINT `WorkItem_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FundingStage` ADD CONSTRAINT `FundingStage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_fromCashSourceId_fkey` FOREIGN KEY (`fromCashSourceId`) REFERENCES `CashSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_toCashSourceId_fkey` FOREIGN KEY (`toCashSourceId`) REFERENCES `CashSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_cashSourceId_fkey` FOREIGN KEY (`cashSourceId`) REFERENCES `CashSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_fundingStageId_fkey` FOREIGN KEY (`fundingStageId`) REFERENCES `FundingStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
