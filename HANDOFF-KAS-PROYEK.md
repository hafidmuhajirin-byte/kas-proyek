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

## 5. Login

### Produksi (VPS — yang dipakai)

| Role | Username | Password |
|------|----------|----------|
| OWNER | `owner` | password yang sudah dirotasi (bukan `owner123`) |
| ADMIN | **`adminok`** | password yang sudah dirotasi |
| MANDOR | akun Mandor di DB | password masing-masing |

Username seed `admin` / `admin123` **tidak ada / tidak dipakai** di DB produksi. Pakai **`adminok`**.

### Seed lokal (development saja)

| Role | Username | Password |
|------|----------|----------|
| OWNER | `owner` | `owner123` |
| ADMIN | `adminok` | `admin123` |
| MANDOR | `mandor` | `mandor123` |

**Ganti semua password** setelah go-live.

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

## 10. Checklist prompt — diverifikasi 31 Jul 2026 (cloud agent)

| # | Item | Status |
|---|------|--------|
| 1 | DNS `hafitproyek.online` → `38.103.170.55` | **OK** (Google 8.8.8.8 + Cloudflare 1.1.1.1); NS = `ns1/ns2.niagahoster.com` |
| 2 | nginx IP + domain (default_server, proxy :3000) | **OK** — `/login` 200 di HTTPS domain, www, dan HTTP IP |
| 3 | PM2 `kas-proyek` | **OK** — online |
| 4 | `AUTH_COOKIE_SECURE=true` | **OK** di `.env` VPS |
| 5 | SSL Let's Encrypt | **OK** — CN `hafitproyek.online`, valid s/d ~29 Okt 2026 |

Jika HP masih 404: cache DNS lama. Pakai data seluler / tab samaran, atau buka dulu `http://38.103.170.55/login`.

Kode fitur live (login wallpaper/Jost, mandor Maps, keuntungan, hapus proyek aman, cookie secure) sudah disinkron ke GitHub di branch PR.

---

## 11. Status selesai — 31 Jul 2026 (cloud agent)

| Item | Status |
|------|--------|
| Deploy VPS dari branch GitHub (`pm2 stop` → sync → `build` → `pm2 start`) | **SELESAI** — HEAD `82cffa7`, PM2 online |
| Password root VPS | **SELESAI dirotasi** (simpan dari chat agent) |
| Password akun aplikasi | **SELESAI dirotasi** untuk `owner` + `adminok` (bukan seed `admin`/`mandor` — akun itu tidak ada di DB produksi) |
| Mandor lapangan (`feri`, `hendra`, `istiadi`, `lutfi`, `sulianto`) | **Tidak diubah** (akun nyata) |
| DNS / nginx / HTTPS / cookie secure | **OK** (lihat §10) |

### Login produksi (setelah rotasi)

- Owner: username `owner` — password **lihat chat agent** (bukan `owner123`)
- Admin: username `adminok` — password **lihat chat agent**
- Seed lama `owner123` / `admin123` / `mandor123` **tidak berlaku** untuk akun yang sudah dirotasi

### Setelah merge PR ke `main`

Di VPS (opsional, agar tracking git rapi):

```bash
cd /var/www/kas-proyek
git fetch origin
git checkout main
git reset --hard origin/main
```

(App sudah menjalankan commit yang sama dengan branch PR.)

---

## 12. Prioritas lanjut (fitur baru)

Handoff go-live **selesai**. Lanjut hanya fitur/bug baru sesuai permintaan user.

File prompt: `PROMPT-CURSOR-PC.txt`.

*Akhir handoff.*
