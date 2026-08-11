-- Role login khusus foto + migrasi dari flag fotoOnly
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'MANDOR', 'ADM_FOTO') NOT NULL DEFAULT 'MANDOR';

UPDATE `User` SET `role` = 'ADM_FOTO' WHERE `role` = 'MANDOR' AND `fotoOnly` = true;

ALTER TABLE `User` DROP COLUMN `fotoOnly`;
