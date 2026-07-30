/**
 * PM2 — Kas Proyek
 * instances: 1 wajib (SQLite — jangan cluster banyak writer)
 *
 * Start:  pm2 start ecosystem.config.cjs
 * Reload: pm2 reload kas-proyek
 */
module.exports = {
  apps: [
    {
      name: "kas-proyek",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // Next.js memuat .env dari cwd; pastikan file .env ada di root proyek
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
