import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
  experimental: {
    serverActions: {
      // Bukti / batch foto lokasi (~5 × ~180 KB) + overhead form
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
