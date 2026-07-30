import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createAdapter() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diatur (contoh mysql://user:pass@127.0.0.1:3306/kas_proyek)",
    );
  }

  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, "").split("?")[0];
  const socketPath =
    process.env.MYSQL_SOCKET ||
    parsed.searchParams.get("socket") ||
    parsed.searchParams.get("socketPath") ||
    undefined;

  // Shared hosting: "localhost" sering gagal (IPv6/socket). Prefer 127.0.0.1 untuk TCP.
  let host = parsed.hostname || "127.0.0.1";
  if (host === "localhost" && !socketPath) {
    host = "127.0.0.1";
  }

  if (socketPath) {
    return new PrismaMariaDb({
      socketPath,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database,
      connectionLimit: 5,
    });
  }

  return new PrismaMariaDb({
    host,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit: 5,
  });
}

function createPrismaClient() {
  return new PrismaClient({ adapter: createAdapter() });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
