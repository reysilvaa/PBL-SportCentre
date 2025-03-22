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
oda  - JWT-based authentication
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
└── package.json         # Dependencies
```

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
  "dev": "ts-node-dev src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js",
  "lint": "eslint src/**/*.ts",
  "format": "prettier --write src/**/*.ts"
}
```

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
Made with ❤️ by PBL Team
</div>