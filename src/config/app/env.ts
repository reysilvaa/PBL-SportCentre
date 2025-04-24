import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { EnvConfig } from '../../types/env';

// Tentukan mode environment: development, production atau test
const env = process.env.NODE_ENV || 'development';
console.info(`🌐 Environment mode: ${env}`);

// Load file environment sesuai dengan mode
// Prioritas: .env.{environment} -> .env (sebagai fallback) -> default values dari kode
const envPaths = [
  path.resolve(process.cwd(), `.env.${env}`),
  path.resolve(process.cwd(), '.env'),
];

// Tandai apakah file env ditemukan
let envFileLoaded = false;

// Load environment dari file yang tersedia
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.info(`✅ Loaded environment from ${envPath}`);
    envFileLoaded = true;
    break;
  }
}

// Jika tidak ada file env yang ditemukan, tampilkan peringatan
if (!envFileLoaded) {
  console.warn(
    '⚠️ Tidak menemukan file environment. Menggunakan nilai default.'
  );
}

// Type untuk sameSite
type SameSiteOption = boolean | 'none' | 'lax' | 'strict';

// Fungsi untuk memberikan nilai default dengan tipe yang tepat
function getEnvValue<K extends keyof EnvConfig>(
  key: K,
  defaultValue: string
): string {
  const value = process.env[key] || defaultValue;

  if (!process.env[key]) {
    if (env === 'production') {
      console.warn(
        `⚠️ Variabel lingkungan ${key} tidak diatur, menggunakan nilai default`
      );
    } else {
      console.info(`ℹ️ Menggunakan nilai default untuk ${key}`);
    }
  }

  return value;
}

// Variabel lingkungan default berdasarkan tipe dari EnvConfig
const defaultValues: Record<keyof EnvConfig, string> = {
  DATABASE_URL: 'mysql://root@localhost:3306/sport_center',
  NODE_ENV: env,
  PORT: '3000',
  JWT_SECRET: 'rahasia-jwt-default-harus-diganti',
  MIDTRANS_CLIENT_KEY: 'SB-Mid-client-00000000000000000',
  MIDTRANS_SERVER_KEY: 'SB-Mid-server-00000000000000000',
  API_URL: 'https://api.sportcenter.id',
  API_URL_DEV: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:3001',
  COOKIE_DOMAIN: '',
  CACHE_TTL: '300',
  COOKIE_SECRET: 'secret-cookie-key-default',
  COOKIE_MAX_AGE: '86400000',
  CLOUDINARY_API_KEY: '000000000000000',
  CLOUDINARY_API_SECRET: 'abcdefghijklmnopqrstuvwxyz',
  CLOUDINARY_CLOUD_NAME: 'default-cloud-name',
  PASETO_LOCAL_KEY: 'k4.local.default-key-000000000000000000000000000000',
  PASETO_SECRET_KEY: 'k4.secret.default-key-000000000000000000000000000000',
  PASETO_PUBLIC_KEY: 'k4.public.default-key-000000000000000000000000000000',
};

// Buat konfigurasi aplikasi
export const config = {
  port: getEnvValue('PORT', defaultValues.PORT),
  jwtSecret: getEnvValue('JWT_SECRET', defaultValues.JWT_SECRET),
  midtransServerKey: getEnvValue(
    'MIDTRANS_SERVER_KEY',
    defaultValues.MIDTRANS_SERVER_KEY
  ),
  midtransClientKey: getEnvValue(
    'MIDTRANS_CLIENT_KEY',
    defaultValues.MIDTRANS_CLIENT_KEY
  ),
  db: {
    url: getEnvValue('DATABASE_URL', defaultValues.DATABASE_URL),
  },
  cache: {
    ttl: parseInt(getEnvValue('CACHE_TTL', defaultValues.CACHE_TTL)),
  },
  urls: {
    api:
      env === 'production'
        ? getEnvValue('API_URL', defaultValues.API_URL)
        : getEnvValue('API_URL_DEV', defaultValues.API_URL_DEV),
    frontend: getEnvValue('FRONTEND_URL', defaultValues.FRONTEND_URL),
  },
  cookies: {
    secret: getEnvValue('COOKIE_SECRET', defaultValues.COOKIE_SECRET),
    maxAge: parseInt(
      getEnvValue('COOKIE_MAX_AGE', defaultValues.COOKIE_MAX_AGE)
    ),
    httpOnly: true,
    secure: env === 'production',
    sameSite: (env === 'production' ? 'none' : 'lax') as SameSiteOption,
    domain:
      getEnvValue('COOKIE_DOMAIN', defaultValues.COOKIE_DOMAIN) || undefined,
  },
  cloudinary: {
    cloudName: getEnvValue(
      'CLOUDINARY_CLOUD_NAME',
      defaultValues.CLOUDINARY_CLOUD_NAME
    ),
    apiKey: getEnvValue('CLOUDINARY_API_KEY', defaultValues.CLOUDINARY_API_KEY),
    apiSecret: getEnvValue(
      'CLOUDINARY_API_SECRET',
      defaultValues.CLOUDINARY_API_SECRET
    ),
  },
  frontendUrl: getEnvValue('FRONTEND_URL', defaultValues.FRONTEND_URL),
  cookieSecret: getEnvValue('COOKIE_SECRET', defaultValues.COOKIE_SECRET),
  environment: env,
  isProduction: env === 'production',
};

// Fungsi validasi konfigurasi
function validateConfig(): void {
  // Validasi konfigurasi minimum untuk production
  if (env === 'production') {
    // JWT Secret harus diubah di production
    if (config.jwtSecret === defaultValues.JWT_SECRET) {
      console.warn(
        '❌ JWT Secret menggunakan nilai default, harap ubah untuk keamanan'
      );
    }

    // Konfigurasi midtrans harus diisi di production
    if (
      !config.midtransServerKey ||
      config.midtransServerKey === defaultValues.MIDTRANS_SERVER_KEY
    ) {
      console.warn(
        '⚠️ Konfigurasi Midtrans tidak lengkap, pembayaran mungkin tidak akan berfungsi'
      );
    }

    // Konfigurasi cloudinary harus diisi di production
    if (config.cloudinary.apiKey === defaultValues.CLOUDINARY_API_KEY) {
      console.warn(
        '⚠️ Konfigurasi Cloudinary tidak lengkap, upload gambar mungkin tidak akan berfungsi'
      );
    }
  }

  // Cek koneksi database
  if (config.db.url === defaultValues.DATABASE_URL && env !== 'test') {
    console.warn(
      '⚠️ Menggunakan konfigurasi database default, pastikan database tersedia'
    );
  }
}

// Jalankan validasi konfigurasi
validateConfig();
