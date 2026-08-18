-- Role Admin Proyek (1 proyek mandiri) + flag kas terpisah
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'ADMIN_PROYEK', 'MANDOR', 'ADM_FOTO') NOT NULL DEFAULT 'MANDOR';

ALTER TABLE `Project` ADD COLUMN `standaloneBookkeeping` BOOLEAN NOT NULL DEFAULT false;
