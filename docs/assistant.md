# Asisten Kas

Asisten lokal (tanpa LLM). **AdminOK** paling aktif: pantau nota/split/pajak/foto, buka chat saat ada masalah, belajar dari data existing.

## Siapa yang mendapat Asisten

| Role | Asisten |
|------|---------|
| Owner, AdminOK | Aktif — termasuk info keuangan (kas, fee, untung, transaksi) |
| Admin Proyek, LPJ Viewer, Mandor | Aktif — hanya info sesuai role (bukan keuangan login lain) |
| **ADM Foto** | **Tidak diaktifkan** |

## Batasan data

- Info hanya sesuai login; tidak membocorkan ringkasan role lain.
- Keuangan (kas besar / fee / keuntungan / transaksi / pengingat Owner) **khusus Owner dan AdminOK**.
- Proyek/pekerjaan **BPK Sofyan** dikecualikan dari semua informasi Asisten.
- Setiap pemberitahuan di chat **bisa diklik** dan langsung membuka halaman terkait.

## Aturan wajib saat menambah menu

1. Tambah entri di [`lib/nav/app-menus.ts`](../lib/nav/app-menus.ts) (`APP_MENUS`).
2. Tambah help di [`lib/assistant/catalog.ts`](../lib/assistant/catalog.ts) (`MENU_HELP`) — TypeScript/`assertMenuHelpComplete` akan gagal jika lupa.
3. Shell (`AppShell` / `MandorShell`) dan Asisten membaca dari sumber yang sama — jangan hardcode list paralel.

## Perilaku

- Cara pakai: hanya di chat (on-demand), tidak memenuhi halaman.
- Masalah data (selisih pecah, satuan beda, approve tertunda, pajak, foto): **chat terbuka** berisi penyebab + solusi (ketuk → halaman).
- Memory satuan: bootstrap dari `MandorExpenseLine` + `MaterialMaster`.

## API

`POST /api/assistant` — `{ message, bootstrap?, checkUnit? }`  
Role `ADM_FOTO` mendapat `403` (`disabled: true`).
