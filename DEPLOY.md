# Panduan Deploy — Kas Proyek

Aplikasi ini memakai **SQLite** (`better-sqlite3`) dan menyimpan upload bukti di **`public/uploads`**. Keduanya butuh **disk persisten yang bisa ditulis**. Karena itu jalur yang disarankan adalah **VPS / hosting Node** (bukan Vercel atau shared hosting PHP saja).

---

## Mengapa VPS / Node hosting?

| Lingkungan | Cocok? | Alasan |
|---|---|---|
| **VPS / Node (PM2, Docker)** | Ya | Disk tetap untuk DB + upload; native module OK |
| Vercel / serverless | Tidak ideal | Filesystem ephemer; SQLite + `better-sqlite3` (native) + upload lokal tidak cocok |
| Shared hosting PHP-only | Tidak | Tidak menjalankan Node/Next.js produksi |
| **Niagahoster / Hostinger cPanel + Setup Node.js App** | Bisa dicoba | **Domain baru (addon domain)** + folder terpisah dari `public_html`; waspadai `better-sqlite3` |
| **VPS / Cloud Node penuh** | Ya (andalan) | Disk persist, native module, kontrol penuh |

---

## Niagahoster / cPanel Setup Node.js App

Jalur ini untuk akun **cPanel** (Niagahoster / Hostinger) yang punya menu **Setup Node.js App** (cari di search bar cPanel → Software).

**Rekomendasi utama:** beli / daftar **domain baru** khusus Kas Proyek, lalu pasang sebagai **Addon Domain** / **Add Website** di hosting yang sama. Situs lama di `public_html` **tetap utuh**.

### Dua aplikasi berdampingan

| Alamat | Isi | Folder |
|---|---|---|
| Domain lama (mis. `cv-agungkarya.com`) | Situs lama (WordPress / PHP) | `public_html` — **jangan timpa** |
| **Domain baru** (mis. `kasproyek.com`) | **Kas Proyek** (Next.js) | Folder baru di home, mis. `kas-proyek` — **bukan** `public_html` |

Database MySQL lama (mis. `u6424712_*`) **tidak terkait** Kas Proyek — biarkan saja. Kas Proyek memakai SQLite sendiri (`prisma/prod.db`).

### 1. Beli / daftar domain baru

1. Daftarkan domain baru khusus Kas Proyek (registrar Niagahoster atau lain).
2. Catat nama domain (contoh: `kasproyek.com`) — nanti dipakai di Addon Domain + Setup Node.js App.

### 2. Tambah sebagai Addon Domain / Add Website

1. Login **cPanel**.
2. Cari **Domains** / **Addon Domains** / **Add Website** (nama menu bisa berbeda per panel).
3. Tambahkan domain baru.
4. **Document Root:** folder **baru**, misalnya:
   - `kas-proyek` → path seperti `/home/USER/kas-proyek`
5. **Jangan** pakai / ganti `public_html` milik situs lama.

### 3. DNS

Pilih salah satu:

- **Nameserver hosting** Niagahoster (paling sederhana jika domain dibeli di situ atau NS diganti ke hosting), atau
- **A record** domain baru → **IP server** hosting (sama dengan situs lama)

Tunggu propagasi DNS sampai domain mengarah ke server.

### 4. Create Application (Setup Node.js App)

1. cPanel → search **`Setup Node.js App`** → buka.
2. Klik **Create Application**.
3. Isi:

| Field | Nilai |
|---|---|
| **Node.js version** | **20.x** jika ada; kalau tidak, versi tertinggi **18+** |
| **Application mode** | **Production** |
| **Application root** | Folder domain baru (mis. `kas-proyek`) — sama dengan Document Root di atas |
| **Application URL** | **Domain baru** (mis. `kasproyek.com`) |
| **Application startup file** | **`server.js`** (ada di root repo proyek ini) |

4. Simpan / Create.

### 5. SSL (HTTPS)

Aktifkan SSL untuk domain baru (cPanel **SSL/TLS Status** / AutoSSL / Let's Encrypt). Pastikan `https://` domain baru hijau sebelum go-live cookie produksi.

### 6. Upload, `.env`, install, migrate, build, restart

**Upload** isi proyek ke folder app (bukan ke `public_html` utama), misalnya via Git, FTP, atau File Manager (ZIP → extract).

Pastikan di root app ada: `package.json`, `server.js`, `prisma/`, `app/`, dll. **Jangan** unggah `node_modules` dari Windows — install di server.

**Environment** — di application root:

```bash
cp .env.example .env
```

Isi minimal di `.env`:

```env
AUTH_SECRET=...          # generate: openssl rand -base64 32
DATABASE_URL=file:./prisma/prod.db
NODE_ENV=production
```

**Juga** set variabel yang sama di antarmuka **Setup Node.js App** → Environment variables:

- `AUTH_SECRET`
- `DATABASE_URL` = `file:./prisma/prod.db`
- `NODE_ENV` = `production`

**Install / migrate / build** — di UI **Setup Node.js App**:

1. Klik **Run NPM Install** (atau setara).
2. Jika ada **terminal / SSH / Enter to virtual environment**:

```bash
npx prisma migrate deploy
npm run build
```

3. Pastikan folder writable:

```bash
mkdir -p public/uploads
chmod -R u+rwX prisma public/uploads
```

4. Di UI Node.js App: **Restart** aplikasi.

### 7. Peringatan: `better-sqlite3` di shared hosting

`better-sqlite3` adalah **native addon**. Jika **Run NPM Install** gagal (error compile / node-gyp / missing build tools):

- **Jangan** paksa di shared ini.
- Eskalasi ke **VPS** (ikuti bagian *Langkah deploy (VPS)*), atau nanti migrasi ke **MySQL** (perubahan kode besar — belum dilakukan di repo ini).

Resource CPU/RAM shared juga terbatas; proses bisa di-kill. Pantau log di UI Node.js App.

### 8. Setelah go-live

- Buka `https://domain-baru-anda` (HTTPS dari AutoSSL / SSL Status).
- Login → **ganti password default** (`admin` / `operator`).
- Update kode: jangan timpa `prisma/prod.db` atau isi `public/uploads`.

### Alternatif opsional: subdomain

Jika belum siap beli domain baru, bisa pakai subdomain (mis. `kas.cv-agungkarya.com`) dengan Document Root folder terpisah — langkah Node.js App, `.env`, install, migrate, build sama. **Jalur utama yang disarankan tetap domain baru / addon domain.**

---

## Hostinger / Niagahoster — ringkasan jalur

### Kendala yang tetap berlaku

1. Next.js **bukan** file PHP di `public_html` — butuh Setup Node.js App (atau VPS).
2. `better-sqlite3` sering gagal di shared meski Node ada.
3. SQLite + `public/uploads` butuh disk **writable**.

### Jika Setup Node.js App **tidak** ada

Upgrade **VPS** / Cloud Node, lalu ikuti **Langkah deploy (VPS)**. Jangan unggah Next.js sebagai situs PHP.

### Alternatif MySQL (belum diimplementasi)

Shared biasanya punya MySQL. Ganti Prisma SQLite → MySQL = perubahan kode besar. **Belum** dilakukan di repo — hanya opsi eskalasi jika Node ada tapi SQLite gagal.

---

## Persyaratan

- **Node.js 20+**
- Domain + DNS mengarah ke server
- **HTTPS** (Caddy atau nginx + Let's Encrypt)
- Akses SSH ke server
- Port aplikasi internal (default **3000**) di-proxy oleh reverse proxy

---

## Langkah deploy (VPS)

### 1. Upload kode

```bash
# Opsi A — git
git clone <url-repo-anda> kas-proyek
cd kas-proyek

# Opsi B — salin dari mesin lokal (contoh)
# scp -r ./kas-proyek user@server:/var/www/kas-proyek
```

### 2. Environment

```bash
cp .env.example .env
nano .env   # atau editor lain
```

Isi minimal:

- `DATABASE_URL="file:./prisma/prod.db"`
- `AUTH_SECRET=` — generate: `openssl rand -base64 32`
- `NODE_ENV=production`

**Jangan** commit file `.env` ke git.

### 3. Dependensi

```bash
npm ci
# atau, jika belum ada package-lock yang dipakai di server:
# npm install
```

`better-sqlite3` dikompilasi native di server Linux — install harus dijalankan **di mesin produksi**, bukan hanya menyalin `node_modules` dari Windows.

### 4. Database

```bash
npx prisma migrate deploy
# atau: npm run db:deploy
```

**Seed (opsional, hanya DB kosong):**

```bash
npm run db:seed
```

Seed membuat akun awal (`admin` / `operator`). **Jangan** jalankan seed di database yang sudah berisi data produksi — bisa bentrok atau menimpa ekspektasi data awal.

### 5. Build & jalankan

```bash
npm run build
npm start
```

Atau dengan **PM2** (disarankan agar proses tetap hidup):

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # ikuti perintah yang ditampilkan agar auto-start saat reboot
```

Konfigurasi PM2 memakai **`instances: 1`** — SQLite tidak cocok di-cluster banyak writer.

`next start` di Next.js 16 default bind ke **`0.0.0.0:3000`** (siap di-proxy dari luar).

### 6. Disk yang harus persist & writable

Pastikan folder/file berikut **tidak hilang** saat deploy ulang dan **bisa ditulis** oleh user proses Node:

| Path | Isi |
|---|---|
| `prisma/prod.db` (+ journal WAL bila ada) | Database SQLite |
| `public/uploads/` | File bukti transaksi |

Tips:

```bash
mkdir -p public/uploads
chmod -R u+rwX prisma public/uploads
```

Saat update kode: **jangan** timpa `prod.db` atau isi `public/uploads` dengan kosong dari repo.

### 7. Reverse proxy + HTTPS

Arahkan domain ke proses di `127.0.0.1:3000`.

**Contoh Caddy** (`Caddyfile`):

```
kas.contoh.com {
  reverse_proxy 127.0.0.1:3000
}
```

**Contoh nginx:**

```nginx
server {
  listen 443 ssl http2;
  server_name kas.contoh.com;

  # ssl_certificate ...;
  # ssl_certificate_key ...;

  client_max_body_size 8m;  # upload bukti ~5 MB + overhead

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 8. Cookie & keamanan setelah go-live

- Cookie sesi memakai **`secure: true`** otomatis saat `NODE_ENV=production` (lihat `lib/auth.ts`). Pastikan situs diakses lewat **HTTPS**.
- **Ganti password default** (`admin` / `operator`) segera setelah login pertama.
- Pastikan `AUTH_SECRET` unik dan rahasia.

---

## Docker (opsional)

Lihat `Dockerfile` dan `.dockerignore` di root proyek.

```bash
docker build -t kas-proyek .
docker run -d --name kas-proyek \
  -p 3000:3000 \
  --env-file .env \
  -v kas-proyek-db:/app/prisma \
  -v kas-proyek-uploads:/app/public/uploads \
  kas-proyek
```

Setelah container pertama kali jalan (volume `prisma` kosong), jalankan migrasi:

```bash
docker exec -it kas-proyek npx prisma migrate deploy
# opsional DB kosong:
docker exec -it kas-proyek npm run db:seed
```

Volume memastikan DB dan upload tetap ada meski container diganti.

---

## Checklist singkat

**cPanel (Setup Node.js App) — domain baru:**

1. [ ] Domain baru didaftarkan
2. [ ] Addon Domain / Add Website + Document Root folder baru (bukan `public_html`)
3. [ ] DNS (NS hosting atau A record → IP server)
4. [ ] Create Application: Node 20.x, Production, URL = domain baru, startup `server.js`
5. [ ] SSL aktif
6. [ ] Kode di app root; `.env` + env UI diisi
7. [ ] Run NPM Install → `prisma migrate deploy` → `npm run build` → Restart
8. [ ] `prisma/` & `public/uploads` writable; waspadai gagal `better-sqlite3`
9. [ ] Password default diganti

**VPS:**

1. [ ] Node 20+ terpasang
2. [ ] `.env` dari `.env.example`, `AUTH_SECRET` diisi
3. [ ] `npm ci` → `npm run db:deploy` → `npm run build`
4. [ ] PM2 / `npm start` jalan di port 3000
5. [ ] `prisma/prod.db` & `public/uploads` persist + writable
6. [ ] HTTPS + reverse proxy
7. [ ] Password default diganti

---

## Butuh bantuan deploy lebih lanjut?

Siapkan info ini:

1. **Provider** (Niagahoster / Hostinger cPanel, VPS, dll.)
2. **Domain baru** Kas Proyek (nama yang sudah dibeli / didaftarkan)
3. **Setup Node.js App** — sudah create application atau belum
4. **Akses SSH** — ya / tidak
5. Hasil **NPM Install** (sukses / error `better-sqlite3`)
