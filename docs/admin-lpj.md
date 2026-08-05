# Admin LPJ Swakelola

Modul **hanya untuk role ADMIN**. Login Owner dan Mandor tidak berubah.

## Alur

1. Admin login → `/admin/lpj` (daftar proyek aktif)
2. Klik proyek → menu: SPK, Bank, Nota, Absen, Pajak, Export
3. Admin membaca data kas yang diisi Owner; tidak memutasi Kas Besar

## Fitur awal (fase ini)

- Schema: `SpkBudgetLine`, `BankTranche`, `MaterialMaster`, `Worker`, `WorkerAttendance`, `PayrollHokLine`, `TaxWithholdingLine`, `LpjSnapshot` + field opsional `isMaterialAlam` pada Transaction
- `lib/lpj/tax-compliance.ts` — PPN/PPh, material alam 0%, plafon monitoring 3,5% SPK (**tanpa** smart-split fiktif)
- `lib/lpj/smart-estimator.ts` — rasio upah/material per kategori SPK
- `lib/buku-kas/bank.ts` — blok Buku Bank + validasi fase 70%
- UI Admin di `/admin/lpj/**`

## Tes

```bash
npm run test:lpj
```

## Migrasi

```bash
npx prisma migrate deploy
```
