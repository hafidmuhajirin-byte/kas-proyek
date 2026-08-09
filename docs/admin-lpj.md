# Admin LPJ Swakelola

Modul **hanya untuk role ADMIN**. Login Owner dan Mandor tidak berubah.

## Login Admin (produksi)

Username: **`adminok`** (bukan `admin`)  
Password: yang sudah dipakai di VPS (bukan seed `admin123` jika sudah dirotasi).

Setelah modul LPJ di-deploy: login → `/admin/lpj` (daftar proyek aktif).

## Review Nota Mandor (`/admin/lpj/[projectId]/nota`)

Alur:

1. Admin review nota + bukti foto Mandor.
2. **Pecah isi** dulu (tabel sama dengan Owner: `MandorExpenseBreakdownForm`).
3. Jika total Mandor **> Rp 2 jt** dan pecah isi parsial — tombol **Split Nota** (opsional) membuat BKK berikutnya.
4. Lanjut pecah isi di BKK baru sampai jumlah semua BKK = total Mandor.
5. **Setujui** per BKK (total baris = nominal BKK; sum BKK = upload Mandor), atau **Tolak** → Mandor mendapat notifikasi ganti bukti.

### Nota Admin LPJ

Tombol **+ Tambah nota Admin LPJ** membuat transaksi `isAdminLpjNota=true` (+ `isMandorExpense`):

| Tempat | Perilaku |
|--------|----------|
| **Admin LPJ** (Review Nota, BKU/BKT/Pajak) | Nilai penuh di DB — ikut pecah isi / pajak seperti nota biasa |
| **Owner** — panel Bukti belanja Mandor | Muncul sebagai bukti tambahan **Rp 0**; label “LPJ admin”; **tidak** dijumlahkan ke Total / Ringkasan dana |
| Kas proyek Owner | Tidak terpotong (sudah dikecualikan lewat `isMandorExpense`) |

Catatan: nota Admin LPJ **bukan** bukti belanja Mandor untuk dana Owner. Tidak wajib tautan pencairan. Flag ikut ke BKK anak saat Split Nota.

Catatan umum:

- Pecah isi ≠ Split Nota. Satu nota di bawah 2 jt cukup dipecah isinya (contoh Hebel/besi).
- Split **manual**, maksimal 3 BKK; bukan auto-evasi pajak.
- Dana Mandor (`totalBukti`) tetap dari upload asli Mandor (skip `isAdminLpjNota`); LPJ memakai tiap BKK (bukan shell).

## Estimasi borongan Mandor

Setelah pagu **Perencanaan**, **Pengawasan**, dan **Pengelolaan** diisi di Ringkasan SPK, beranda Mandor menampilkan estimasi:

`ROUNDDOWN( (nilai kontrak − perencanaan − pengawasan − pengelolaan) × 70% ; -3 )`

(bulat ke bawah ke kelipatan Rp1.000). Jika salah satu dari ketiga pagu belum diisi, estimasi **tidak** ditampilkan.

## Fitur lain

- Schema: `SpkBudgetLine`, `BankTranche`, `MaterialMaster`, `Worker`, `WorkerAttendance`, `PayrollHokLine`, `TaxWithholdingLine`, `LpjSnapshot` + `isMaterialAlam` / `isSplitParent` / `splitParentId`
- `lib/lpj/tax-compliance.ts` — PPN/PPh, material alam 0%, plafon monitoring 3,5% SPK
- `lib/buku-kas/bank.ts` — blok Buku Bank + validasi fase 70%
- UI Admin di `/admin/lpj/**`

## Tes

```bash
npm run test:lpj
npm run test:mandor-split
```

## Migrasi

```bash
npx prisma migrate deploy
```
