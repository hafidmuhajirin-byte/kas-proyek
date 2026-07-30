-- Jalankan di phpMyAdmin → database u6424712__kasproyek → tab SQL
-- Pastikan tabel User sudah ada (hasil import migration.sql)

INSERT INTO `User` (`id`, `username`, `name`, `passwordHash`, `role`, `createdAt`, `updatedAt`)
VALUES
  ('cmseedowner000000000001', 'owner', 'Owner', '$2b$10$iWjK6gCNWycnh6MUOT1OIeTVBsw1QsMJAIdfFO86ZdDgQWpKVVoBC', 'OWNER', NOW(3), NOW(3)),
  ('cmseedadmin000000000001', 'admin', 'Admin Pengawas', '$2b$10$piuwK15GXJQpe3ElwfKm3.epfzmHJ6TnS5pkceU02hDP4wcAhsKw2', 'ADMIN', NOW(3), NOW(3)),
  ('cmseedmandor00000000001', 'mandor', 'Mandor Lapangan', '$2b$10$Gc1lS37jbq085BBKRRBgse0yyr5fqb10yEqw7IWiUIhFvy0dRSfHi', 'MANDOR', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `passwordHash` = VALUES(`passwordHash`),
  `role` = VALUES(`role`),
  `updatedAt` = NOW(3);

INSERT INTO `CashSource` (`id`, `name`, `type`, `createdAt`, `updatedAt`)
VALUES
  ('cmseedcashsrc0000000001', 'Kas Tunai', 'CASH', NOW(3), NOW(3)),
  ('cmseedcashsrc0000000002', 'Bank', 'BANK', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt` = NOW(3);

INSERT INTO `Category` (`id`, `name`, `type`, `createdAt`, `updatedAt`)
VALUES
  ('cmseedcat00000000000001', 'Pembayaran Kas (Permintaan)', 'INCOME', NOW(3), NOW(3)),
  ('cmseedcat00000000000002', 'Termin / DP', 'INCOME', NOW(3), NOW(3)),
  ('cmseedcat00000000000003', 'Material', 'EXPENSE', NOW(3), NOW(3)),
  ('cmseedcat00000000000004', 'Upah', 'EXPENSE', NOW(3), NOW(3)),
  ('cmseedcat00000000000005', 'Operasional', 'EXPENSE', NOW(3), NOW(3)),
  ('cmseedcat00000000000006', 'Pencairan ke Mandor', 'EXPENSE', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt` = NOW(3);
