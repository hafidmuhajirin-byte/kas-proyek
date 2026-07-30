# Buat tabel lewat phpMyAdmin (kalau migrate SSH gagal)

1. cPanel → **phpMyAdmin**
2. Klik database **`u6424712__kasproyek`** (dua underscore) di kiri
3. Tab **Import** (atau **SQL**)
4. Upload / paste file:
   `public_html/hafitproyek.online/prisma/migrations/20260730140000_init_mysql/migration.sql`
   (ada di hosting setelah extract ZIP MySQL)
5. **Go** / Execute — harus sukses tanpa error
6. Tab **Structure** — harus ada tabel **User**, Project, Transaction, dll.

Lalu di Terminal:

```bash
source /home/u6424712/nodevenv/public_html/hafitproyek.online/20/bin/activate
cd /home/u6424712/public_html/hafitproyek.online
export DATABASE_URL="mysql://u6424712_kasproyek:hafitmuhajirin123456789@127.0.0.1:3306/u6424712__kasproyek"
npx prisma migrate resolve --applied 20260730140000_init_mysql
npx prisma db seed
```

Restart Node.js → login `owner` / `owner123`
