# CI/CD Workflow untuk Backend Sport Center

Workflow ini mengotomatisasi proses build, test, dan deployment untuk aplikasi backend Sport Center.

## Alur Kerja

1. **Build**: Membangun aplikasi dan menjalankan test
2. **Deploy**: Deploy ke server production jika push ke branch `main`

## Secrets yang Diperlukan

Untuk menggunakan workflow ini, tambahkan secrets berikut di repository GitHub:

### Deployment Server
- `HOST`: Alamat IP atau hostname server
- `USERNAME`: Username untuk SSH ke server
- `SSH_KEY`: Private key SSH untuk server

### Konfigurasi Aplikasi (.env)
- `DATABASE_URL`: URL koneksi database
- `JWT_SECRET`: Secret key untuk JWT
- `MIDTRANS_CLIENT_KEY`: Client key Midtrans
- `MIDTRANS_SERVER_KEY`: Server key Midtrans
- `API_URL`: URL API untuk production
- `API_URL_DEV`: URL API untuk development
- `FRONTEND_URL`: URL frontend untuk CORS
- `REDIS_URL`: URL koneksi Redis
- `REDIS_PASSWORD`: Password Redis (opsional)
- `COOKIE_SECRET`: Secret untuk signed cookies
- `CLOUDINARY_API_KEY`: API key Cloudinary
- `CLOUDINARY_API_SECRET`: API secret Cloudinary
- `CLOUDINARY_CLOUD_NAME`: Cloud name Cloudinary

## Cara Menambahkan Secrets

1. Buka repository GitHub
2. Klik "Settings" > "Secrets and variables" > "Actions"
3. Klik "New repository secret"
4. Masukkan nama dan nilai secret
5. Klik "Add secret"

## Catatan Penting

- Server menggunakan Node.js v22.16.0 dan npm v10.9.2
- Pastikan server memiliki akses ke repository GitHub
- Pastikan server memiliki direktori `/pbl/backend` yang sudah diinisialisasi dengan Git
- Struktur build aplikasi berada di folder `dist/src/`
- Proses deployment akan menginstall ulang dependensi untuk mengatasi masalah modul yang hilang 