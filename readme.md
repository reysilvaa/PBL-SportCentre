# 🏀 Backend Sport Center 

<div align="center">
    <img src="https://img.shields.io/badge/Node.js-v22.8.0-green?logo=nodedotjs" alt="Node.js Version">
    <img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Prisma-ORM-blue?logo=prisma" alt="Prisma ORM">
    <img src="https://img.shields.io/badge/Express.js-black?logo=express" alt="Express.js">
</div>

## 🔍 Project Overview

Backend aplikasi Sport Center menggunakan teknologi modern untuk membangun API yang powerfull, scalable, dan real-time:

- **🚀 Node.js**: Runtime environment JavaScript
- **💻 TypeScript**: Tipesafe JavaScript
- **💾 Prisma ORM**: Database toolkit modern
- **🌐 Express.js**: Web application framework

---

## 🛠 Requirements

<details>
<summary>📋 Spesifikasi Versi</summary>

- **Node.js**: v22.8.0 atau lebih baru
- **npm**: v10.8.2 atau lebih baru

> 💡 **Tips**: Gunakan [nvm](https://github.com/nvm-sh/nvm) untuk manajemen versi Node.js
</details>

## 🚦 Instalasi & Setup

### 1. 💽 Setup Database
```bash
# Buat database MySQL bernama sport_center
mysql -u root -p
CREATE DATABASE sport_center;
```

### 2. 📦 Install Dependencies
```bash
npm install
```

### 3. 🔐 Konfigurasi JWT Secret
```bash
# Generate secret key
openssl rand -base64 32
```

Simpan di `.env`:
```env
JWT_SECRET=your_generated_secret_key
```

### 4-7. 🛠 Inisialisasi & Migrasi

```bash
# Inisialisasi TypeScript
npx tsc --init

# Inisialisasi Prisma
npx prisma init

# Generate Prisma Client
npx prisma generate

# Migrasi Database
npx prisma migrate dev --name init
```

### 8. 🏃 Menjalankan Aplikasi

<table>
    <tr>
        <th>Mode</th>
        <th>Perintah</th>
    </tr>
    <tr>
        <td>Pengembangan</td>
        <td><code>npm run dev</code></td>
    </tr>
    <tr>
        <td>Produksi</td>
        <td><code>npm run build && npm start</code></td>
    </tr>
</table>

### 9. 📖 Dokumentasi API
🔗 Akses: [http://localhost:3000/](http://localhost:3000/)

---

## 📦 Ecosystem Packages

### 🔒 Dependencies
<div style="display: flex; flex-wrap: wrap; gap: 10px;">
    <img src="https://img.shields.io/badge/@prisma/client-Database%20ORM-brightgreen" alt="Prisma Client">
    <img src="https://img.shields.io/badge/bcryptjs-Password%20Hashing-yellow" alt="Bcrypt">
    <img src="https://img.shields.io/badge/cors-CORS%20Middleware-blue" alt="CORS">
    <img src="https://img.shields.io/badge/express-Web%20Framework-lightgrey" alt="Express">
    <img src="https://img.shields.io/badge/jsonwebtoken-Authentication-orange" alt="JWT">
    <img src="https://img.shields.io/badge/socket.io-Real--time%20API-black" alt="Socket.io">
</div>

### 🛠 DevDependencies
<div style="display: flex; flex-wrap: wrap; gap: 10px;">
    <img src="https://img.shields.io/badge/TypeScript-Compiler-blue" alt="TypeScript">
    <img src="https://img.shields.io/badge/ESLint-Code%20Linting-purple" alt="ESLint">
    <img src="https://img.shields.io/badge/Prettier-Code%20Formatting-pink" alt="Prettier">
    <img src="https://img.shields.io/badge/ts--node-TypeScript%20Executor-green" alt="ts-node">
</div>

---

## 📂 Struktur Project

```
backend/
├── 📂 prisma/             # Konfigurasi dan skema database Prisma
├── 📂 src/
│   ├── 🔧 config/         # Konfigurasi database, logger, dan pengaturan enviroment aplikasi
│   ├── 📄 documentation/  # Plain HTML page untuk Documentation API aplikasi
│   ├── 🎮 controllers/    # Logika bisnis aplikasi
│   ├── 🛡️ middlewares/   # Middleware Express
│   ├── 📊 models/         # Model database (jika diperlukan)
│   ├── 🌐 routes/         # Routing API
│   ├── 🔬 services/       # Service layer
│   ├── 🧰 utils/          # Helper functions
│   ├── 🚀 app.ts          # Entry point aplikasi
├── 🔐 .env                # Konfigurasi environment
├── 📦 package.json        # Dependencies dan scripts
├── ⚙️ tsconfig.json       # Konfigurasi TypeScript
└── 📖 README.md           # Dokumentasi
```

## 🌟 Fitur Utama
- 🔒 Autentikasi JWT
- 💾 ORM dengan Prisma
- 🔄 Real-time API dengan Socket.io
- 🛡️ Keamanan dengan Helmet
- 📝 Logging dengan Morgan

---

## 📌 Catatan Penting
> **Perhatian**: Pastikan selalu update dependencies dan perhatikan keamanan aplikasi Anda.