# 🏀 Sport Center Reservation API

<div align="center">

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.8.0-green?logo=nodedotjs)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue?logo=prisma)](https://www.prisma.io/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-black?logo=express)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--time-black?logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

🏢 Backend API untuk sistem reservasi fasilitas olahraga modern

</div>

## 🌟 Fitur Utama

- 🔒 **Autentikasi & Otorisasi**
  oda - JWT-based authentication

  - Role-based access control (Super Admin/Branch Admin/User)
  - Secure password hashing dengan bcrypt

- 📅 **Manajemen Reservasi**

  - Real-time booking status via Socket.io
  - Pencarian & filter fasilitas olahraga
  - Sistem pembayaran terintegrasi dengan Midtrans
  - Review dan rating fasilitas

- 🔔 **Notifikasi**

  - Real-time updates via Socket.io
  - Activity log tracking
  - Status pembayaran dan booking

- 📊 **Manajemen Cabang**
  - Multiple branch management
  - Analisis pendapatan per cabang
  - Manajemen lapangan dan tipe lapangan
  - Sistem promosi dan diskon

## 🛠 Tech Stack

- **Runtime**: Node.js v22.8.0
- **Language**: TypeScript 5.0
- **Framework**: Express.js
- **Database**: MySQL + Prisma ORM
- **Real-time**: Socket.io
- **Payment Gateway**: Midtrans
- **File Storage**: Cloudinary
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston
- **Deployment**: PM2 dengan clustering

## 🚀 Quick Start

### Prerequisites

```bash
# Versi minimum yang dibutuhkan
Node.js >= v22.8.0
npm >= v10.8.2
MySQL >= 8.0
```

### Instalasi

1. **Clone & Install Dependencies**

   ```bash
   git clone <repository-url>
   cd backend
   npm install
   ```

2. **Setup Environment**

   ```bash
   # Copy .env.example
   cp .env.example .env
   ```

   Edit `.env` dengan konfigurasi yang sesuai:

   ```env
   # Database
   DATABASE_URL="mysql://user:password@localhost:3306/sport_center"

   # JWT
   JWT_ACCESS_TOKEN_SECRET=your_access_token_secret
   JWT_REFRESH_TOKEN_SECRET=your_refresh_token_secret

   # Midtrans
   MIDTRANS_SERVER_KEY=your_server_key
   MIDTRANS_CLIENT_KEY=your_client_key

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. **Setup Database & Prisma**

   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Run migrations
   npx prisma migrate dev

   # Seed database
   npx prisma db seed
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

   Server berjalan di `http://localhost:3000`

## 🚀 Deployment dengan PM2

1. **Build aplikasi**:

   ```bash
   npm run build
   ```

2. **Jalankan dengan PM2**:

   ```bash
   npm run start:prod
   ```

3. **Perintah pengelolaan**:

   ```bash
   # Menghentikan aplikasi
   npm run stop:prod

   # Restart aplikasi
   npm run restart:prod

   # Monitoring
   npm run monitor:prod

   # Membersihkan log
   pm2 flush

   # Reset PM2
   pm2 reset all
   ```

## 🔄 Panduan Menjalankan Aplikasi

### 💻 Mode Development

Mode development dioptimalkan untuk kecepatan pengembangan dan debugging:

1. **Jalankan dalam mode development**:

   ```bash
   npm run dev
   ```

2. **Fitur mode development**:

   - Hot-reload dengan nodemon
   - Debugging lebih detail
   - Tidak ada kompresi response untuk memudahkan debugging
   - HTTPS enforcement dinonaktifkan
   - Automatic Prisma Client generation

3. **Debugging**:

   ```bash
   # Jalankan dengan inspeksi node
   node --inspect src/app.ts

   # Atau dengan lebih banyak log
   DEBUG=* npm run dev
   ```

### 🏭 Mode Production

Mode production dioptimalkan untuk performa dan keamanan maksimal:

1. **Build aplikasi**:

   ```bash
   npm run build
   ```

2. **Jalankan dalam cluster mode dengan PM2**:

   ```bash
   npm run start:prod
   ```

3. **Fitur mode production**:

   - Clustering untuk pemanfaatan multi-core
   - Kompresi response untuk kecepatan loading
   - Rate limiting untuk keamanan
   - Optimasi memori dengan garbage collection otomatis
   - HTTPS enforcement diaktifkan
   - Caching API selama 5 menit

4. **Monitoring dan pengelolaan**:

   ```bash
   # Monitoring real-time
   npm run monitor:prod

   # Lihat log aplikasi
   pm2 logs

   # Tampilkan status instansi
   pm2 status
   ```

5. **Skalabilitas**:
   - Aplikasi akan otomatis menyesuaikan jumlah instansi berdasarkan beban CPU
   - Port akan dialokasikan secara dinamis untuk setiap instansi
   - Batas memori dikontrol untuk mencegah overload server

### 📊 Perbandingan Mode

| Fitur         | Development    | Production        |
| ------------- | -------------- | ----------------- |
| Hot-reload    | ✅             | ❌                |
| Debugging     | Detail tinggi  | Minimal           |
| Kompresi      | ❌             | ✅                |
| Clustering    | ❌             | ✅ (Auto-scaling) |
| Caching       | ❌             | ✅ (5 menit)      |
| HTTPS         | Opsional       | Wajib             |
| Memory Limit  | Tidak dibatasi | 200MB/instance    |
| GC Manual     | ❌             | ✅ (2 menit)      |
| Rate Limiting | Longgar        | Ketat (100/15min) |

## 💪 Optimasi Performa

Aplikasi telah dioptimalkan untuk performa maksimal dengan:

### 🧠 Manajemen Memori

- **Batas memori**: Maksimal 200MB per instance
- **Garbage Collection**: Otomatis setiap 2 menit
- **V8 Engine**: `--max-old-space-size=200`, `--max-semi-space-size=64`
- **Optimasi Flag**: `--optimize-for-size`, `--gc-interval=50`

### 🔄 Clustering & Scaling

- **Mode Cluster PM2**: Pemanfaatan multi-core CPU
- **Auto-scaling**: Berdasarkan beban CPU
- **Instance**: Minimum 1, maksimum 2 untuk penggunaan memori optimal

### 🌐 Network Optimization

- **Kompresi**: Dengan middleware `compression`
- **Caching**: API responses selama 5 menit
- **WebSocket**: Payload maksimum 50KB, optimasi ping interval

### 🔒 Keamanan & Pembatasan

- **Rate Limiting**: 100 request per 15 menit
- **Headers Keamanan**: Dengan `helmet`
- **HTTPS Enforcement**: Otomatis di production

### ⚡ Runtime Performance

- **Timeout**: Listen timeout 5000ms, kill timeout 2000ms
- **Restart**: Eksponensial backoff 50ms
- **Tracing**: `--trace-warnings`, `--trace-uncaught`, `--trace-sync-io`

## 📁 Struktur Project

```
backend/
├── prisma/                 # Database schema & migrations
│   ├── migrations/        # Database migrations
│   ├── schema.prisma      # Prisma schema
│   └── seeds/            # Database seeders
├── src/
│   ├── config/           # App configuration
│   ├── controllers/      # Request handlers
│   │   ├── admin/       # Admin controllers
│   │   ├── owner/       # Owner controllers
│   │   └── user/        # User controllers
│   ├── middlewares/      # Express middlewares
│   ├── routes/           # API routes
│   ├── socket-handlers/  # Socket.io handlers
│   ├── utils/            # Helper functions
│   ├── zod-schemas/      # Request validation
│   └── app.ts           # App entry point
├── .env                  # Environment variables
├── ecosystem.config.js   # Konfigurasi PM2
└── package.json         # Dependencies
```

## ❓ Troubleshooting & FAQ

### Masalah Umum

1. **🐛 Aplikasi tidak dapat dimulai**

   - Periksa port 3000 sudah digunakan atau tidak
   - Periksa status database MySQL
   - Cek file log di `logs/err.log`

2. **📈 Memori tinggi**

   - Jalankan `npm run monitor:prod` untuk memantau penggunaan
   - Turunkan nilai `max_instances` jika diperlukan
   - Cek bottleneck dengan monitoring

3. **🐢 Performa lambat**
   - Optimasi query database
   - Kurangi jumlah instance pada server dengan CPU terbatas
   - Cek logs untuk blocking operations

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Endpoints

<details>
<summary><b>🔐 Auth</b></summary>

- `POST /auth/register` - Register user baru
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
</details>

<details>
<summary><b>🏢 Branch</b></summary>

- `GET /branches` - List semua cabang
- `GET /branches/:id` - Detail cabang
- `POST /branches` - Tambah cabang baru (Super Admin)
- `PUT /branches/:id` - Update cabang
- `DELETE /branches/:id` - Hapus cabang
</details>

<details>
<summary><b>⚽ Field</b></summary>

- `GET /fields` - List semua lapangan
- `GET /fields/:id` - Detail lapangan
- `POST /fields` - Tambah lapangan baru (Admin)
- `PUT /fields/:id` - Update lapangan
- `DELETE /fields/:id` - Hapus lapangan
</details>

<details>
<summary><b>📅 Booking</b></summary>

- `GET /bookings` - List reservasi user
- `POST /bookings` - Buat reservasi baru
- `GET /bookings/:id` - Detail reservasi
- `DELETE /bookings/:id` - Batalkan reservasi
</details>

<details>
<summary><b>💰 Payment</b></summary>

- `GET /payments` - List pembayaran user
- `GET /payments/:id` - Detail pembayaran
- `POST /payments/notification` - Webhook Midtrans
</details>

## 🔧 Scripts

```json
{
  "dev": "npx prisma generate && nodemon src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js",
  "lint": "eslint . --ext .ts --fix",
  "start:prod": "pm2 start ecosystem.config.js --node-args='--expose-gc'",
  "stop:prod": "pm2 stop ecosystem.config.js",
  "restart:prod": "pm2 restart ecosystem.config.js",
  "monitor:prod": "pm2 monit"
}
```

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
Made with ❤️ by PBL Team
</div>

## Konfigurasi Environment

Aplikasi ini menggunakan sistem konfigurasi berbasis tipe dengan nilai default yang sudah disediakan, sehingga **tidak memerlukan file `.env`** secara mayoritas. Berikut cara konfigurasi:

### Cara 1: Tanpa File .env (Rekomendasi untuk Pengembangan)

Aplikasi akan menggunakan nilai default yang aman untuk pengembangan. Anda dapat langsung menjalankan aplikasi tanpa membuat file .env apapun. Sistem akan menampilkan informasi nilai default yang digunakan.

```bash
# Cukup jalankan aplikasi
npm run dev
```

### Cara 2: Dengan File Environment (Untuk Production)

Untuk lingkungan production atau jika Anda perlu mengubah nilai default:

1. Salin file `.env.type` sebagai referensi:

   ```bash
   # Untuk development
   cp .env.type .env.development

   # Untuk production
   cp .env.type .env.production
   ```

2. Edit file tersebut dengan konfigurasi yang sesuai.

3. Aplikasi akan mencari file konfigurasi dengan prioritas:
   - `.env.{NODE_ENV}` (misalnya .env.development atau .env.production)
   - `.env` (sebagai fallback)
   - Nilai default yang dikodekan dalam aplikasi

### Cara Kerja

Semua variabel lingkungan didefinisikan sebagai tipe di `src/types/env.ts` dan memiliki nilai default di dalam kode. Sistem akan:

1. Mencoba memuat file lingkungan yang sesuai
2. Jika tidak ditemukan, menggunakan nilai default
3. Memberikan peringatan untuk nilai-nilai kritis yang menggunakan default di lingkungan production

> **Catatan Keamanan**: Di lingkungan production, pastikan Anda mengatur variabel lingkungan kritis seperti `JWT_SECRET`, kredensial database, dan kunci API. Meskipun ada nilai default, nilai tersebut tidak boleh digunakan di production.
