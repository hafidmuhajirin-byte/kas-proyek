# Panduan Deploy — Kas Proyek

Aplikasi: **Next.js 16** + **Prisma** + **MySQL**, auth role `OWNER` / `ADMIN` / `MANDOR`.

**Produksi saat ini:** VPS Jagoan Hosting Nebula → https://hafitproyek.online  
(IP backup: http://38.103.170.55)

| Lingkungan | Cocok? | Catatan |
|---|---|---|
| **VPS + MySQL lokal + PM2 + nginx** | Ya (produksi) | Path `/var/www/kas-proyek` |
| **Render + MySQL remote** | Alternatif | [deploy-fix/RENDER.md](./deploy-fix/RENDER.md) |
| **cPanel Setup Node.js** | Tidak disarankan | Bentrok resource dengan CV di Niaga shared |
| Vercel / serverless | Tidak ideal | Upload lokal + driver MariaDB |

**Jangan** jalankan Kas Proyek di Niagahoster shared Node. Site **CV/kasir** tetap di shared; Kas Proyek hanya di VPS.

Detail serah terima: [HANDOFF-KAS-PROYEK.md](./HANDOFF-KAS-PROYEK.md)

---

## VPS (Jagoan Nebula) — jalur utama

| Item | Nilai |
|------|--------|
| IP | `38.103.170.55` |
| App | `/var/www/kas-proyek` |
| PM2 | proses `kas-proyek` |
| Web | nginx → `127.0.0.1:3000` |
| DB | MySQL lokal `kas_proyek` |
| Domain | `hafitproyek.online` (A record → IP VPS) |

### Deploy aman (hindari 502)

```bash
cd /var/www/kas-proyek
pm2 stop kas-proyek
git pull   # atau sync kode
npm ci     # jika dependency berubah
npx prisma migrate deploy
npm run build
pm2 start kas-proyek
```

Jangan biarkan PM2 serve build lama sambil `next build` di path yang sama tanpa stop.

### ENV penting

```env
DATABASE_URL=mysql://USER:PASS@127.0.0.1:3306/kas_proyek
AUTH_SECRET=...
NODE_ENV=production
AUTH_COOKIE_SECURE=true
```

- `AUTH_COOKIE_SECURE=false` hanya untuk uji HTTP via IP sebelum SSL
- Setelah HTTPS domain aktif: **`true`**
- Jangan commit `.env`

### Disk persist

| Path | Isi |
|---|---|
| `public/uploads/` | Bukti transaksi |

```bash
mkdir -p public/uploads
chmod -R u+rwX public/uploads
```

### DNS

Zone Editor Niagahoster: record **A** `hafitproyek.online` (dan `www` jika dipakai) → **`38.103.170.55`**.  
Jangan ubah A untuk `cpanel` / `webmail`.

### Seed login (ganti segera)

| Role | Username | Password |
|------|----------|----------|
| OWNER | `owner` | `owner123` |
| ADMIN | `admin` | `admin123` |
| MANDOR | `mandor` | `mandor123` |

Data awal: `deploy-fix/data-from-local.sql` (saat handoff: 7 proyek, 13 transaksi).

---

## Lokal (dev)

```bash
git clone https://github.com/hafidmuhajirin-byte/kas-proyek.git
cd kas-proyek
npm install
cp .env.example .env   # isi DATABASE_URL + AUTH_SECRET
npx prisma migrate deploy
npm run dev
```

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

`.env` harus mengarah ke MySQL yang bisa dijangkau dari container.

```bash
docker exec -it kas-proyek npx prisma migrate deploy
```

---

## Checklist produksi

1. [ ] DNS A → IP VPS; `nslookup hafitproyek.online` benar
2. [ ] HTTPS hijau; `AUTH_COOKIE_SECURE=true`
3. [ ] PM2 `kas-proyek` online; nginx proxy OK
4. [ ] Password seed diganti
5. [ ] Password root VPS sudah dirotasi (jangan pakai yang pernah terekspos di chat)
6. [ ] `public/uploads` writable
