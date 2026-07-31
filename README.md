# Sistem Kas Proyek

Aplikasi web pembukuan kas untuk banyak proyek di berbagai lokasi, dengan kas masuk/keluar dari berbagai sumber.

## Fitur

- Login Owner / Admin / Mandor
- Manajemen proyek (nama, lokasi, status, nilai kontrak, saldo awal)
- **Pendanaan bertahap** per proyek (DP, Termin 1, Termin 2, dst.) dengan progress %
- Sumber kas (bank, tunai, transfer klien, lainnya)
- Kategori pemasukan & pengeluaran
- Transaksi kas + tautan ke tahapan dana + upload bukti opsional
- Dashboard saldo & progress pencairan
- Laporan berfilter + ekspor CSV

## Alur kerja singkat

1. Owner membuat **Proyek** dan isi **nilai kontrak**
2. Di detail proyek, atur **tahapan dana** (mis. DP 30%, Termin 1 40%, Termin 2 30%)
3. Owner menambah **Sumber Kas** bila perlu
4. Catat **Transaksi** pemasukan → pilih tahapan yang sedang cair
5. Pantau progress di **Dashboard** / detail proyek, dan **Laporan**

## Menjalankan

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Akun awal

| Username | Password | Role |
|---|---|---|
| `owner` | `owner123` | Owner |
| `admin` | `admin123` | Admin |
| `mandor` | `mandor123` | Mandor |

Ganti password default setelah login pertama. Ubah juga `AUTH_SECRET` di file `.env`.

## Deploy produksi

- **Render (disarankan):** [deploy-fix/RENDER.md](./deploy-fix/RENDER.md)
- **cPanel MySQL:** [deploy-fix/HOSTING-MYSQL.md](./deploy-fix/HOSTING-MYSQL.md)
- **VPS / Docker / overview:** [DEPLOY.md](./DEPLOY.md)

## Teknologi

Next.js, TypeScript, Tailwind CSS, Prisma, MySQL / MariaDB
