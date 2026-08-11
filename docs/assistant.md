# Asisten Kas

Asisten lokal (tanpa LLM) untuk semua role. **AdminOK** paling aktif: pantau nota/split/pajak/foto, buka chat saat ada masalah, belajar dari data existing.

## Aturan wajib saat menambah menu

1. Tambah entri di [`lib/nav/app-menus.ts`](../lib/nav/app-menus.ts) (`APP_MENUS`).
2. Tambah help di [`lib/assistant/catalog.ts`](../lib/assistant/catalog.ts) (`MENU_HELP`) — TypeScript/`assertMenuHelpComplete` akan gagal jika lupa.
3. Shell (`AppShell` / `MandorShell`) dan Asisten membaca dari sumber yang sama — jangan hardcode list paralel.

## Perilaku

- Cara pakai: hanya di chat (on-demand), tidak memenuhi halaman.
- Masalah data (selisih pecah, satuan beda, approve tertunda, pajak, foto): **chat terbuka** berisi penyebab + solusi.
- Memory satuan: bootstrap dari `MandorExpenseLine` + `MaterialMaster`.

## API

`POST /api/assistant` — `{ message, bootstrap?, checkUnit? }`
