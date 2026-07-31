# Deploy Kas Proyek ke Render (gratis)

CV tetap di Niagahoster. Kas Proyek pindah ke Render agar tidak bentrok resource.

## Batasan free tier
- App bisa **sleep** jika sepi → request pertama lambat (cold start)
- Disk **ephemeral** — file di `public/uploads` hilang saat redeploy / restart. Bukti penting: pertimbangkan VPS berbayar atau object storage nanti jika upload kritis.
- Bukan 100% setara VPS berbayar

## Persiapan

### 1. Kode di GitHub
Repo sudah siap di GitHub. Pastikan branch `main` berisi kode MySQL terbaru.

**Jangan** commit file `.env` (rahasia).

### 2. Database MySQL
Pakai DB yang sudah ada di Niagahoster: `u6424712__kasproyek` (atau DB yang Anda buat).

1. cPanel → **Remote MySQL**
2. Tambahkan host `%` (semua IP) **atau** IP outbound Render
3. `DATABASE_URL` di Render memakai **hostname server**, bukan `127.0.0.1` / `localhost`:

```
mysql://u6424712_kasproyek:PASSWORD@srv170.niagahoster.com:3306/u6424712__kasproyek
```

Ganti host sesuai yang tertulis di cPanel (sering `srvXXX.niagahoster.com`).  
Tes dulu dari PC: apakah MySQL remote bisa masuk dengan host itu.

Jika password mengandung `@`, `#`, `%`, dll. — **URL-encode** dulu.

Kalau Remote MySQL tidak diizinkan hosting → pakai MySQL/Postgres gratis lain, atau MySQL hanya di VPS.

### 3. Buat Web Service di Render
1. Daftar https://render.com → **New** → **Web Service**
2. Connect repo GitHub Kas Proyek
3. Isi:

| Field | Value |
|--------|--------|
| Runtime | **Node** |
| Build Command | `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` |
| Start Command | `npm run start` |
| Instance | **Free** |

Blueprint opsional: `render.yaml` di root repo (env secrets tetap diisi manual).

4. **Environment** (Environment Variables):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | string acak panjang (`openssl rand -base64 32`) |
| `DATABASE_URL` | `mysql://USER:PASS@HOST:3306/DATABASE` |

5. Deploy → tunggu build selesai
6. Buka URL `https://xxx.onrender.com/login`

### 4. Domain `hafitproyek.online`
1. Render → service → **Custom Domains** → tambah `hafitproyek.online`
2. Di DNS domain (Niagahoster/Hostinger): ikuti instruksi Render (biasanya CNAME / A)
3. Di shared hosting: **jangan** jalankan Setup Node.js untuk domain ini lagi (hentikan app Node di cPanel jika masih aktif)

### 5. Data
- Kalau tabel sudah ada di MySQL → migrate biasanya no-op / aman
- Import `deploy-fix/data-from-local.sql` via phpMyAdmin jika data lokal belum masuk
- Atau di Render Shell (kalau ada): `npx prisma db seed`

Akun seed default: `owner` / `owner123`, `admin` / `admin123`, `mandor` / `mandor123` — **ganti segera**.

## Setelah live
- Pastikan CV di Niagahoster tetap OK (Node shared untuk Kas Proyek sudah dimatikan)
- Ganti password default / jangan biarkan password MySQL tertulis di chat

## Troubleshooting
| Masalah | Cek |
|---------|-----|
| Build gagal Prisma | `DATABASE_URL` salah / Remote MySQL ditolak |
| P1001 can't reach DB | Host harus `srv...niagahoster.com`, bukan localhost; Remote MySQL aktif |
| Sleep / lambat | Normal free tier; upgrade Render atau VPS |
| 404 domain | DNS custom domain belum propaga |
| Upload hilang setelah redeploy | Disk ephemeral free tier — lihat batasan di atas |
