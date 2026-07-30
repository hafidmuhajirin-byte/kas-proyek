import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
  experimental: {
    serverActions: {
      // Bukti transaksi max 5 MB + overhead form
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
