<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Stack: Next.js 16 (Turbopack) + Prisma 7 + MariaDB. Standard scripts live in `package.json` (`dev`, `lint`, `build`, `db:migrate`, `db:deploy`, `db:seed`). Deploy/setup context is in `README.md`, `DEPLOY.md`, and `HANDOFF-KAS-PROYEK.md`.

The startup update script runs `npm install` and `npx prisma generate` (the Prisma client is generated into the gitignored `lib/generated/prisma`, so it must be regenerated — `next dev` does NOT generate it).

Non-obvious caveats:
- MariaDB is required but is NOT auto-started on VM boot. Start it before running the app or any DB command: `sudo mariadbd-safe &` (or `sudo service mariadb start`), then verify with `sudo mysqladmin ping`.
- Local dev DB is `kas_proyek` with user `kas` / password `kaspass` on `127.0.0.1:3306`. The gitignored `.env` (dev values, `AUTH_COOKIE_SECURE=false`) is already present; recreate it from `.env.example` if missing.
- After a fresh DB, apply schema + seed: `npx prisma migrate deploy` then `npm run db:seed`. Migrations/seed are intentionally NOT in the update script.
- Seed login accounts (dev only): `owner`/`owner123` (OWNER → `/dashboard`), `adminok`/`admin123` and `admin`/`admin123` (ADMIN → `/admin/lpj`), `mandor`/`mandor123` (MANDOR → `/mandor`). `middleware.ts` role-gates routes and redirects `/` by role.
- `lib/prisma.ts` uses the `@prisma/adapter-mariadb` driver adapter and rewrites host `localhost` → `127.0.0.1`; keep `DATABASE_URL` on `127.0.0.1` (or set `MYSQL_SOCKET`).
- `npm run lint` reports pre-existing errors in `server.js` and `scripts/export-sqlite-to-mysql.js` (CommonJS `require()` rule); these are unrelated to app code.
