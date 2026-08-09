import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
  experimental: {
    serverActions: {
      // Bukti / multi foto lokasi (hingga ~20 × ~400 KB) + overhead form
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
