# Panduan Deploy — Kas Proyek

Aplikasi ini memakai **MySQL / MariaDB** (Prisma + `@prisma/adapter-mariadb`) dan menyimpan upload bukti di **`public/uploads`**.

**Jalur yang disarankan:** deploy app ke **[Render](./deploy-fix/RENDER.md)** (gratis), database MySQL tetap di Niagahoster (atau MySQL lain yang bisa diakses remote). Domain contoh: `hafitproyek.online`.

| Lingkungan | Cocok? | Catatan |
|---|---|---|
| **Render + MySQL remote** | Ya (disarankan) | Lihat [deploy-fix/RENDER.md](./deploy-fix/RENDER.md) |
| **VPS / Docker + MySQL** | Ya | Disk persist untuk `public/uploads` |
| **cPanel Setup Node.js + MySQL lokal** | Bisa | Lihat [deploy-fix/HOSTING-MYSQL.md](./deploy-fix/HOSTING-MYSQL.md) |
| Vercel / serverless | Tidak ideal | Upload lokal + cold start; native MariaDB driver kurang cocok |

---

## Render (disarankan)

Ikuti langkah lengkap di **[deploy-fix/RENDER.md](./deploy-fix/RENDER.md)**.

Ringkas:

1. Push repo ke GitHub (sudah siap).
2. Aktifkan **Remote MySQL** di cPanel Niagahoster (host `%` atau IP Render).
3. Buat Web Service di Render: build `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`, start `npm run start`.
4. Set `NODE_ENV`, `AUTH_SECRET`, `DATABASE_URL` (host `srvXXX.niagahoster.com`, bukan `localhost`).
5. Custom domain `hafitproyek.online` + DNS sesuai instruksi Render.
6. Import data (`deploy-fix/data-from-local.sql`) atau `npx prisma db seed` jika DB kosong.

---

## cPanel (Niagahoster / Hostinger) — MySQL lokal

Lihat **[deploy-fix/HOSTING-MYSQL.md](./deploy-fix/HOSTING-MYSQL.md)**.

Poin penting:

- `DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DATABASE`
- Startup file: `server.js`
- `npx prisma migrate deploy` lalu `npm run build` / Restart
- Upload bukti butuh folder `public/uploads` writable

**Catatan:** shared Node sering bentrok resource dengan situs CV di hosting yang sama — itulah alasan jalur Render disarankan.

---

## Persyaratan (VPS)

- **Node.js 20+**
- **MySQL / MariaDB** (lokal atau remote)
- Domain + DNS + **HTTPS**
- Folder `public/uploads` writable & persist

---

## Langkah deploy (VPS)

### 1. Upload kode

```bash
git clone <url-repo-anda> kas-proyek
cd kas-proyek
```

### 2. Environment

```bash
cp .env.example .env
nano .env
```

Isi minimal:

```env
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/kas_proyek"
AUTH_SECRET=...   # openssl rand -base64 32
NODE_ENV=production
```

Jika password MySQL mengandung `@`, `#`, `%`, dll. — **URL-encode** dulu.

**Jangan** commit file `.env`.

### 3. Dependensi

```bash
npm ci
```

### 4. Database

```bash
npx prisma migrate deploy
# DB kosong saja:
npm run db:seed
```

Seed membuat akun: `owner` / `owner123`, `admin` / `admin123`, `mandor` / `mandor123`.  
**Jangan** seed di DB produksi yang sudah berisi data.

### 5. Build & jalankan

```bash
npm run build
npm start
```

Atau **PM2**:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 6. Disk yang harus persist

| Path | Isi |
|---|---|
| `public/uploads/` | File bukti transaksi |

Database ada di **MySQL** (bukan file di disk app). Saat update kode: jangan hapus isi `public/uploads`.

```bash
mkdir -p public/uploads
chmod -R u+rwX public/uploads
```

### 7. Reverse proxy + HTTPS

Arahkan domain ke `127.0.0.1:3000`.

**Caddy:**

```
kas.contoh.com {
  reverse_proxy 127.0.0.1:3000
}
```

**nginx** — set `client_max_body_size 8m` untuk upload bukti ~5 MB.

### 8. Keamanan setelah go-live

- Cookie sesi `secure: true` saat `NODE_ENV=production` — wajib **HTTPS**
- Ganti password default segera
- `AUTH_SECRET` unik dan rahasia

---

## Docker (opsional)

```bash
docker build -t kas-proyek .
docker run -d --name kas-proyek \
  -p 3000:3000 \
  --env-file .env \
  -v kas-proyek-uploads:/app/public/uploads \
  kas-proyek
```

`.env` harus mengarah ke MySQL yang bisa dijangkau dari container (host LAN / `host.docker.internal`, bukan hanya `127.0.0.1` di host tanpa bridge).

```bash
docker exec -it kas-proyek npx prisma migrate deploy
# opsional DB kosong:
docker exec -it kas-proyek npm run db:seed
```

---

## Checklist singkat

**Render:**

1. [ ] Repo GitHub terhubung
2. [ ] Remote MySQL aktif; `DATABASE_URL` pakai host `srv...`
3. [ ] Env: `NODE_ENV`, `AUTH_SECRET`, `DATABASE_URL`
4. [ ] Build + migrate sukses; login di URL Render
5. [ ] Custom domain + DNS
6. [ ] Password default diganti

**VPS:**

1. [ ] Node 20+ & MySQL siap
2. [ ] `.env` dari `.env.example`
3. [ ] `npm ci` → `db:deploy` → `build` → PM2 / `npm start`
4. [ ] `public/uploads` persist + writable
5. [ ] HTTPS + reverse proxy
6. [ ] Password default diganti

---

## Butuh bantuan lebih lanjut?

Siapkan:

1. Provider (Render / VPS / cPanel)
2. Domain Kas Proyek
3. Apakah Remote MySQL sudah diaktifkan (jika DB di Niagahoster + app di Render)
4. Log error build / `P1001` / migrate jika gagal
