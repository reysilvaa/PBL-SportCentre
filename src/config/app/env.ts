import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { EnvConfig } from '../../types/env';

// Tentukan mode environment: development, production atau test
const env = process.env.NODE_ENV || 'development';
console.info(`🌐 Environment mode: ${env}`);

// Load file environment sesuai dengan mode
// Prioritas: .env file
const envPath = path.resolve(process.cwd(), '.env');

// Cek apakah file .env ada
if (!fs.existsSync(envPath)) {
  console.error('❌ File .env tidak ditemukan! Aplikasi membutuhkan file .env.');
  process.exit(1); // Keluar dari aplikasi jika .env tidak ditemukan
}

// Load file .env
dotenv.config({ path: envPath });
console.info(`✅ Loaded environment from ${envPath}`);

// Type untuk sameSite
type SameSiteOption = boolean | 'none' | 'lax' | 'strict';

// Fungsi untuk mendapatkan nilai dari .env
function getEnvValue<K extends keyof EnvConfig>(key: K): string {
  const value = process.env[key];

  if (!value) {
    console.error(`❌ Variabel lingkungan ${key} tidak ditemukan dalam file .env!`);
    throw new Error(`Required environment variable ${key} is missing in .env file`);
  }

  return value;
}

// Buat konfigurasi aplikasi hanya dari nilai .env
export const config = {
  port: getEnvValue('PORT'),
  jwtSecret: getEnvValue('JWT_SECRET'),
  midtransServerKey: getEnvValue('MIDTRANS_SERVER_KEY'),
  midtransClientKey: getEnvValue('MIDTRANS_CLIENT_KEY'),
  db: {
    url: getEnvValue('DATABASE_URL'),
  },
  cache: {
    ttl: parseInt(getEnvValue('CACHE_TTL')),
  },
  redis: {
    url: getEnvValue('REDIS_URL'),
    password: process.env.REDIS_PASSWORD || '', // Password bisa kosong
    ttl: parseInt(getEnvValue('REDIS_TTL')),
  },
  urls: {
    api: env === 'production' ? getEnvValue('API_URL') : getEnvValue('API_URL_DEV'),
    frontend: getEnvValue('FRONTEND_URL'),
  },
  cookies: {
    secret: getEnvValue('COOKIE_SECRET'),
    maxAge: parseInt(getEnvValue('COOKIE_MAX_AGE')),
    httpOnly: true,
    secure: true,
    sameSite: 'none' as SameSiteOption,
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  cloudinary: {
    cloudName: getEnvValue('CLOUDINARY_CLOUD_NAME'),
    apiKey: getEnvValue('CLOUDINARY_API_KEY'),
    apiSecret: getEnvValue('CLOUDINARY_API_SECRET'),
  },
  frontendUrl: getEnvValue('FRONTEND_URL'),
  cookieSecret: getEnvValue('COOKIE_SECRET'),
  environment: env,
  isProduction: env === 'production',
};

// Print konfigurasi yang berhasil dimuat
console.info('📋 Konfigurasi berhasil dimuat dari file .env:');
console.info(`📌 PORT: ${config.port}`);
console.info(`📌 API URL: ${config.urls.api}`);
console.info(`📌 Frontend URL: ${config.urls.frontend}`);
console.info(`📌 Redis URL: ${config.redis.url}`);
console.info(`📌 Redis TTL: ${config.redis.ttl}`);
console.info(`📌 Cache TTL: ${config.cache.ttl}`);

// Validasi konfigurasi
function validateConfig(): void {
  // Validasi konfigurasi untuk production
  if (env === 'production') {
    // Cek JWT Secret
    if (!config.jwtSecret || config.jwtSecret.length < 20) {
      console.warn('❌ JWT Secret tidak aman. Gunakan string acak yang panjang.');
    }

    // Cek Midtrans
    if (config.midtransServerKey.includes('SB-Mid-server')) {
      console.warn('⚠️ Menggunakan kunci Midtrans sandbox di mode production');
    }

    // Cek Redis
    if (config.redis.url.includes('localhost')) {
      console.warn('⚠️ Menggunakan Redis lokal di mode production');
    }
  }
}

// Jalankan validasi konfigurasi
validateConfig();
