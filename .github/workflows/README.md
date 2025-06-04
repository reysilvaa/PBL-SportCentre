# CI/CD Workflow untuk Backend Sport Center

Workflow ini mengotomatisasi proses build, test, dan deployment untuk aplikasi backend Sport Center.

## Alur Kerja

1. **Build**: Membangun aplikasi dan menjalankan test
2. **Deploy**: Deploy ke server production jika push ke branch `main`

## Secrets yang Diperlukan

Untuk menggunakan workflow ini, tambahkan secrets berikut di repository GitHub:

### Production Server
- `HOST`: Alamat IP atau hostname server
- `USERNAME`: Username untuk SSH ke server
- `SSH_KEY`: Private key SSH untuk server

## Cara Menambahkan Secrets

1. Buka repository GitHub
2. Klik "Settings" > "Secrets and variables" > "Actions"
3. Klik "New repository secret"
4. Masukkan nama dan nilai secret
5. Klik "Add secret"

## Catatan Penting

- Pastikan server memiliki Node.js dan npm yang terinstall
- Pastikan server memiliki akses ke repository GitHub
- Pastikan server memiliki direktori `/pbl/backend` yang sudah diinisialisasi dengan Git
- Struktur build aplikasi berada di folder `dist/src/`
- Proses deployment akan menginstall ulang dependensi untuk mengatasi masalah modul yang hilang 