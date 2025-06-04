# Dokumentasi CI/CD Backend Sport Center

## Gambaran Umum

Repositori ini menggunakan GitHub Actions untuk CI/CD (Continuous Integration/Continuous Deployment). Proses ini memungkinkan pengujian dan deployment otomatis setiap kali ada perubahan pada branch utama.

## Alur CI/CD

1. **Continuous Integration (CI)**
   - Build aplikasi
   - Jalankan linter
   - Jalankan unit test
   - Jalankan integration test

2. **Continuous Deployment (CD)**
   - Deploy ke server production ketika ada push ke branch `main`
   - Menginstall ulang dependensi untuk mengatasi masalah modul yang hilang
   - Restart aplikasi dengan PM2

## Konfigurasi

Konfigurasi CI/CD terdapat di file `.github/workflows/ci-cd.yml`.

## Secrets

Untuk menggunakan workflow CI/CD, tambahkan secrets berikut di repository GitHub:

- `HOST`: Alamat IP atau hostname server
- `USERNAME`: Username untuk SSH ke server
- `SSH_KEY`: Private key SSH untuk server

## Struktur Build

Setelah proses build, aplikasi akan berada di folder `dist/src/`. File utama yang dijalankan adalah `dist/app.js`.

## Troubleshooting

Jika terjadi error "Cannot find module", langkah-langkah berikut dapat dilakukan:

```bash
# Hapus node_modules dan package-lock.json
rm -rf node_modules
rm -f package-lock.json

# Install ulang semua dependensi
npm install --no-fund --no-audit

# Install debug, express dan finalhandler secara eksplisit
npm install debug express finalhandler --save

# Bersihkan cache npm
npm cache clean --force

# Build aplikasi
npm run build
```

## Pemantauan

Untuk memantau aplikasi yang berjalan:

```bash
pm2 logs
pm2 monit
``` 