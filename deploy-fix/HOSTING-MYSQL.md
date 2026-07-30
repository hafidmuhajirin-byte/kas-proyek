# Deploy MySQL (Niagahoster / cPanel)

App Kas Proyek sekarang memakai **MySQL**, bukan SQLite (menghindari error `better-sqlite3` di shared hosting).

## 1. Buat database di cPanel

1. cPanel → **MySQL Databases**
2. Buat database baru, contoh: `u6424712_kas` (prefix user otomatis)
3. Buat user MySQL + password kuat
4. **Add User to Database** → beri hak **ALL PRIVILEGES**
5. Catat:
   - Database name
   - Username
   - Password
   - Host: biasanya `localhost`

## 2. Upload aplikasi

1. Upload & extract `deploy-fix/kas-proyek-mysql.zip` ke `public_html/hafitproyek.online`
2. Setup Node.js App (Node 20, startup `server.js`) — atau Restart jika sudah ada

## 3. Environment variables

Di Setup Node.js App → Edit → Environment variables:

| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | string acak panjang |
| `DATABASE_URL` | `mysql://USER:PASSWORD@localhost:3306/DATABASE` |

Contoh:

```
mysql://u6424712_kasuser:PasswordAnda@localhost:3306/u6424712_kas
```

Jika password mengandung karakter khusus (`@`, `#`, `%`, dll.), **URL-encode** dulu.

Juga buat file `.env` di root app dengan isi yang sama (cadangan).

## 4. Install dependencies

Setup Node.js → **Run NPM Install**  
(tanpa `better-sqlite3` — lebih ringan)

## 5. Migrasi + seed

SSH / Terminal (setelah `source .../activate`):

```bash
cd ~/public_html/hafitproyek.online
npx prisma migrate deploy
npx prisma db seed
```

Atau Run JS script: `db:deploy` lalu `db:seed` (jika tersedia).

## 6. Restart & login

Restart Node.js App → buka `https://hafitproyek.online/login`

Akun seed default:
- `owner` / `owner123`
- `admin` / `admin123`

**Ganti password segera setelah login.**
