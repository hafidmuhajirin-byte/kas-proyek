-- Login Pelaksana: rule sama Mandor, UI tanpa estimasi/dana Owner
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'ADMIN_PROYEK', 'LPJ_VIEWER', 'MANDOR', 'PELAKSANA', 'ADM_FOTO') NOT NULL DEFAULT 'MANDOR';
