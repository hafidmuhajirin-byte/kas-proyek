import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

function createAdapter() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diatur (contoh mysql://user:pass@localhost:3306/kas_proyek)",
    );
  }
  const parsed = new URL(url);
  let host = parsed.hostname || "127.0.0.1";
  if (host === "localhost") host = "127.0.0.1";
  return new PrismaMariaDb({
    host,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "").split("?")[0],
    connectionLimit: 5,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  const owner = await prisma.user.upsert({
    where: { username: "owner" },
    update: { role: "OWNER", name: "Owner" },
    create: {
      username: "owner",
      name: "Owner",
      passwordHash: hashSync("owner123", 10),
      role: "OWNER",
    },
  });

  // Admin produksi = username adminok (bukan "admin")
  await prisma.user.upsert({
    where: { username: "adminok" },
    update: { role: "ADMIN", name: "Admin Proyek" },
    create: {
      username: "adminok",
      name: "Admin Proyek",
      passwordHash: hashSync("admin123", 10),
      role: "ADMIN",
    },
  });

  // Akun seed lama "admin" (opsional, legacy lokal)
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { role: "ADMIN", name: "Admin Pengawas (legacy)" },
    create: {
      username: "admin",
      name: "Admin Pengawas (legacy)",
      passwordHash: hashSync("admin123", 10),
      role: "ADMIN",
    },
  });

  // Owner terpisah: 'owner'; Admin produksi: 'adminok'

  const mandor = await prisma.user.upsert({
    where: { username: "mandor" },
    update: { role: "MANDOR", name: "Mandor Lapangan" },
    create: {
      username: "mandor",
      name: "Mandor Lapangan",
      passwordHash: hashSync("mandor123", 10),
      role: "MANDOR",
    },
  });

  // Operator lama → mandor
  const legacyOp = await prisma.user.findUnique({
    where: { username: "operator" },
  });
  if (legacyOp) {
    await prisma.user.update({
      where: { id: legacyOp.id },
      data: { role: "MANDOR" },
    });
  }

  const sources = [
    { name: "Kas Tunai", type: "CASH" as const },
    { name: "Bank", type: "BANK" as const },
  ];

  for (const source of sources) {
    const existing = await prisma.cashSource.findFirst({
      where: { name: source.name },
    });
    if (!existing) {
      await prisma.cashSource.create({ data: source });
    }
  }

  const categories = [
    { name: "Pembayaran Kas (Permintaan)", type: "INCOME" as const },
    { name: "Termin / DP", type: "INCOME" as const },
    { name: "Setoran Dana Pribadi", type: "INCOME" as const },
    { name: "Transfer Owner", type: "INCOME" as const },
    { name: "Pengambilan Owner (Pribadi)", type: "EXPENSE" as const },
    { name: "Pencairan ke Mandor", type: "EXPENSE" as const },
    { name: "Material", type: "EXPENSE" as const },
    { name: "Upah", type: "EXPENSE" as const },
    { name: "Transport", type: "EXPENSE" as const },
    { name: "Operasional", type: "EXPENSE" as const },
    { name: "Belanja Mandor", type: "EXPENSE" as const },
    { name: "Bayar jasa perencana", type: "EXPENSE" as const },
    { name: "Bayar jasa Pengawas", type: "EXPENSE" as const },
    { name: "Dana Pengelolaan", type: "EXPENSE" as const },
    { name: "Pembayaran Pajak", type: "EXPENSE" as const },
    { name: "Dana Pembuatan Laporan", type: "EXPENSE" as const },
    { name: "Dana Save", type: "EXPENSE" as const },
    { name: "Sisa Dana Save ke Kas Besar", type: "EXPENSE" as const },
    { name: "Sisa Dana Sekolah", type: "EXPENSE" as const },
    { name: "Transfer Fee ke Bank Pribadi", type: "EXPENSE" as const },
    { name: "Lainnya", type: "INCOME" as const },
    { name: "Lainnya", type: "EXPENSE" as const },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        name_type: { name: category.name, type: category.type },
      },
      update: {},
      create: category,
    });
  }

  // Pastikan role adminok benar
  await prisma.user.updateMany({
    where: { username: "adminok" },
    data: { role: "ADMIN", name: "Admin Proyek" },
  });
  await prisma.user.updateMany({
    where: { username: "admin" },
    data: { role: "ADMIN" },
  });
  await prisma.user.updateMany({
    where: { username: "owner" },
    data: { role: "OWNER" },
  });

  void owner;
  void mandor;

  console.log("Seed selesai.");
  console.log("  owner / owner123  (OWNER)");
  console.log("  adminok / admin123  (ADMIN — sama username produksi)");
  console.log("  admin / admin123  (ADMIN legacy, opsional)");
  console.log("  mandor / mandor123 (MANDOR)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
