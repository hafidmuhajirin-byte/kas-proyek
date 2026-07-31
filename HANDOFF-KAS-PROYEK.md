# HANDOFF — Kas Proyek

Paket serah terima untuk melanjutkan kerja.  
Update terakhir: 31 Juli 2026.

---

## 1. Apa ini?

**Kas Proyek** — aplikasi kas/keuangan proyek konstruksi.

| Item | Detail |
|------|--------|
| Stack | **Next.js 16** + **Prisma** + **MySQL** |
| Auth / role | `OWNER`, `ADMIN`, `MANDOR` |
| Repo GitHub | https://github.com/hafidmuhajirin-byte/kas-proyek |
| Domain produksi | https://hafitproyek.online |
| IP VPS (backup URL) | http://38.103.170.55 |

---

## 2. Path lokal & backup

| Lokasi | Path / URL |
|--------|------------|
| Dev / backup PC | `F:\2026\KAS PROYEK` (atau salinan Google Drive) |
| GitHub | https://github.com/hafidmuhajirin-byte/kas-proyek |

**Cara lanjut (disarankan):**

```bash
git clone https://github.com/hafidmuhajirin-byte/kas-proyek.git
cd kas-proyek
npm install
cp .env.example .env   # isi DATABASE_URL, AUTH_SECRET, AUTH_COOKIE_SECURE
npx prisma migrate deploy
npm run dev
```

Prefer **git clone** daripada menyalin folder Drive (`node_modules` / `.next` tidak ikut).

---

## 3. VPS (Jagoan Hosting — Nebula)

| Item | Nilai |
|------|--------|
| Provider | Jagoan Hosting Nebula |
| IP | **38.103.170.55** |
| OS | Ubuntu 24.04 |
| SSH | `root@38.103.170.55` |
| Password root | **Sudah dirotasi 31 Jul 2026** — minta ke owner (jangan pakai password lama yang pernah di chat) |
| App path | `/var/www/kas-proyek` |
| Process manager | PM2, nama proses: **`kas-proyek`** |
| Web server | nginx reverse proxy → app Node |
| Database | MySQL lokal, DB: **`kas_proyek`** |

### Deploy aman (hindari 502 saat build)

```bash
cd /var/www/kas-proyek
pm2 stop kas-proyek
# git pull / sync kode, npm install jika perlu
npm run build
pm2 start kas-proyek
```

### ENV penting

- `AUTH_COOKIE_SECURE=false` saat akses via **HTTP** (IP mentah)
- `AUTH_COOKIE_SECURE=true` setelah **HTTPS** aktif di domain
- Jangan commit `.env` produksi

---

## 4. URL & DNS

| URL | Status / catatan |
|-----|------------------|
| https://hafitproyek.online | **LIVE** — SSL + Next.js 200 |
| http://38.103.170.55/login | **LIVE** — nginx default_server proxy ke :3000 |

### DNS (cPanel Zone Editor — Niagahoster)

- Record **A** `hafitproyek.online` (dan `www` jika dipakai) → **`38.103.170.55`**
- Jangan ubah A untuk `cpanel` / `webmail`

---

## 5. Login seed (ganti setelah go-live)

| Role | Username | Password |
|------|----------|----------|
| OWNER | `owner` | `owner123` |
| ADMIN | `admin` | `admin123` |
| MANDOR | `mandor` | `mandor123` |

**Ganti semua password** setelah live.

---

## 6. Data

- Import: `deploy-fix/data-from-local.sql`
- Saat handoff: **7 proyek**, **13 transaksi**
- DB MySQL di VPS: `kas_proyek`

CV/kasir tetap di shared hosting Niaga — jangan pindahkan Kas Proyek ke shared Node.

---

## 7. Fitur yang sudah live (sebelum/sesudah sync GitHub)

- Login: wallpaper + font **Jost**
- Mandor: **PROYEK SAYA** + link Maps
- **UPLOAD BUKTI**: kamera + kompres gambar
- Owner dashboard: klik proyek / halaman **keuntungan**
- Mobile: kartu proyek + hapus proyek aman (`DeleteProjectButton`)
- Auth cookie: `AUTH_COOKIE_SECURE`

---

## 8. Masalah 404 — SUDAH DIPERBAIKI (31 Jul 2026)

Penyebab: cache DNS ke Hostinger + nginx tidak melayani akses via IP.  
Perbaikan: `default_server` proxy ke `:3000`. Verified IP + HTTPS → Next.js.

Jika masih 404 di HP: flush DNS / data seluler / hard refresh.  
`nslookup hafitproyek.online` harus `38.103.170.55`.

---

## 9. Keamanan

1. Password root VPS sudah dirotasi — simpan yang baru di password manager
2. Ganti password seed owner/admin/mandor
3. Pastikan `.env` VPS tidak di-commit
4. Produksi HTTPS: `AUTH_COOKIE_SECURE=true`

---

## 10. Prioritas lanjut

1. Verifikasi login HTTPS di HP
2. Ganti password seed aplikasi
3. Lanjut fitur sesuai permintaan user

*Akhir handoff.*
