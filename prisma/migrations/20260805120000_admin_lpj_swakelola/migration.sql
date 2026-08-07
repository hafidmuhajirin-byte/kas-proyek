-- AlterTable Transaction: field opsional LPJ (tidak mengubah alur Owner)
ALTER TABLE `Transaction` ADD COLUMN `isMaterialAlam` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Transaction` ADD COLUMN `taxExemptReason` VARCHAR(191) NULL;
ALTER TABLE `Transaction` ADD COLUMN `spkCategory` ENUM('PERENCANAAN', 'PENGAWASAN', 'PENGELOLAAN', 'REHAB_FISIK', 'REHAB_MEBELAIR', 'PEMBANGUNAN_BARU', 'MEBELAIR_BARU', 'PEMBANGUNAN_APE_LUAR', 'PENGELOLAAN_LINGKUNGAN', 'SANITASI') NULL;
ALTER TABLE `Transaction` ADD COLUMN `materialMasterId` VARCHAR(191) NULL;

-- AlterTable MandorExpenseLine
ALTER TABLE `MandorExpenseLine` ADD COLUMN `isMaterialAlam` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `MandorExpenseLine` ADD COLUMN `taxPpn` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `MandorExpenseLine` ADD COLUMN `taxPph` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `MandorExpenseLine` ADD COLUMN `materialMasterId` VARCHAR(191) NULL;

-- CreateTable MaterialMaster
CREATE TABLE `MaterialMaster` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `isMaterialAlam` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaterialMaster_isMaterialAlam_idx`(`isMaterialAlam`),
    INDEX `MaterialMaster_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SpkBudgetLine
CREATE TABLE `SpkBudgetLine` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('PERENCANAAN', 'PENGAWASAN', 'PENGELOLAAN', 'REHAB_FISIK', 'REHAB_MEBELAIR', 'PEMBANGUNAN_BARU', 'MEBELAIR_BARU', 'PEMBANGUNAN_APE_LUAR', 'PENGELOLAAN_LINGKUNGAN', 'SANITASI') NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `laborPercent` INTEGER NOT NULL DEFAULT 40,
    `materialPercent` INTEGER NOT NULL DEFAULT 60,
    `isBeliBaru` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `SpkBudgetLine_projectId_idx`(`projectId`),
    UNIQUE INDEX `SpkBudgetLine_projectId_category_key`(`projectId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BankTranche
CREATE TABLE `BankTranche` (
    `id` VARCHAR(191) NOT NULL,
    `phase` ENUM('PHASE_70', 'PHASE_30') NOT NULL,
    `percent` INTEGER NOT NULL,
    `plannedAmount` INTEGER NOT NULL DEFAULT 0,
    `receivedAmount` INTEGER NOT NULL DEFAULT 0,
    `receivedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `BankTranche_projectId_idx`(`projectId`),
    UNIQUE INDEX `BankTranche_projectId_phase_key`(`projectId`, `phase`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Worker
CREATE TABLE `Worker` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'Pekerja',
    `dailyWage` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `Worker_projectId_idx`(`projectId`),
    INDEX `Worker_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable WorkerAttendance
CREATE TABLE `WorkerAttendance` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `present` BOOLEAN NOT NULL DEFAULT true,
    `photoUrl` TEXT NULL,
    `source` ENUM('MANDOR', 'ADMIN') NOT NULL DEFAULT 'MANDOR',
    `auditNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workerId` VARCHAR(191) NOT NULL,

    INDEX `WorkerAttendance_workerId_idx`(`workerId`),
    INDEX `WorkerAttendance_date_idx`(`date`),
    UNIQUE INDEX `WorkerAttendance_workerId_date_key`(`workerId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable PayrollHokLine
CREATE TABLE `PayrollHokLine` (
    `id` VARCHAR(191) NOT NULL,
    `periodMonth` VARCHAR(191) NOT NULL,
    `days` DOUBLE NOT NULL DEFAULT 0,
    `dailyWage` INTEGER NOT NULL DEFAULT 0,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `workerId` VARCHAR(191) NOT NULL,

    INDEX `PayrollHokLine_projectId_idx`(`projectId`),
    INDEX `PayrollHokLine_workerId_idx`(`workerId`),
    INDEX `PayrollHokLine_periodMonth_idx`(`periodMonth`),
    UNIQUE INDEX `PayrollHokLine_projectId_workerId_periodMonth_key`(`projectId`, `workerId`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable TaxWithholdingLine
CREATE TABLE `TaxWithholdingLine` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('PPN_11', 'PPH_15', 'PPH_FINAL_35') NOT NULL,
    `baseAmount` INTEGER NOT NULL,
    `taxAmount` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `monthKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NULL,

    INDEX `TaxWithholdingLine_projectId_idx`(`projectId`),
    INDEX `TaxWithholdingLine_monthKey_idx`(`monthKey`),
    INDEX `TaxWithholdingLine_kind_idx`(`kind`),
    INDEX `TaxWithholdingLine_transactionId_idx`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable LpjSnapshot
CREATE TABLE `LpjSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `periodMonth` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `jsonPayload` LONGTEXT NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    INDEX `LpjSnapshot_projectId_idx`(`projectId`),
    INDEX `LpjSnapshot_periodMonth_idx`(`periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes & FKs
CREATE INDEX `Transaction_isMaterialAlam_idx` ON `Transaction`(`isMaterialAlam`);
CREATE INDEX `Transaction_materialMasterId_idx` ON `Transaction`(`materialMasterId`);
CREATE INDEX `MandorExpenseLine_materialMasterId_idx` ON `MandorExpenseLine`(`materialMasterId`);

ALTER TABLE `SpkBudgetLine` ADD CONSTRAINT `SpkBudgetLine_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BankTranche` ADD CONSTRAINT `BankTranche_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Worker` ADD CONSTRAINT `Worker_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkerAttendance` ADD CONSTRAINT `WorkerAttendance_workerId_fkey` FOREIGN KEY (`workerId`) REFERENCES `Worker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PayrollHokLine` ADD CONSTRAINT `PayrollHokLine_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PayrollHokLine` ADD CONSTRAINT `PayrollHokLine_workerId_fkey` FOREIGN KEY (`workerId`) REFERENCES `Worker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TaxWithholdingLine` ADD CONSTRAINT `TaxWithholdingLine_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TaxWithholdingLine` ADD CONSTRAINT `TaxWithholdingLine_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LpjSnapshot` ADD CONSTRAINT `LpjSnapshot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_materialMasterId_fkey` FOREIGN KEY (`materialMasterId`) REFERENCES `MaterialMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MandorExpenseLine` ADD CONSTRAINT `MandorExpenseLine_materialMasterId_fkey` FOREIGN KEY (`materialMasterId`) REFERENCES `MaterialMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
