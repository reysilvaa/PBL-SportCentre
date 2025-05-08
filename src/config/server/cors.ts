import { CorsOptions } from 'cors';
import { config } from '../app/env';

/**
 * Fungsi untuk mendapatkan konfigurasi CORS standar
 * yang dapat digunakan bersama oleh Express dan Socket.IO
 */
export const corsConfig = (): CorsOptions => {
  // Tentukan origins yang diizinkan
  const allowedOrigins = [
    config.urls.frontend,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  // Log allowed origins for debugging
  console.log('CORS Allowed Origins:', allowedOrigins);

  // Menghapus wildcard (*) untuk keamanan
  // Gunakan array domain yang spesifik

  return {
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti aplikasi mobile atau Postman)
      if (!origin) {
        console.log('CORS: Request without origin allowed');
        return callback(null, true);
      }

      // Cek apakah origin ada di daftar yang diizinkan
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log(`CORS: Origin ${origin} allowed`);
        callback(null, true);
      } else {
        // Log origins yang ditolak untuk debugging
        console.warn(`CORS ditolak untuk origin: ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`), false);
      }
    },
    credentials: true, // Izinkan pengiriman cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'If-None-Match'],
    exposedHeaders: ['Content-Length', 'Content-Type', 'ETag', 'Cache-Control'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
}; 