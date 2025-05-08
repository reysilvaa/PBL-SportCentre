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
    'http://localhost:3001'
  ];

  // Menghapus wildcard (*) untuk keamanan
  // Gunakan array domain yang spesifik

  return {
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti aplikasi mobile atau Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Cek apakah origin ada di daftar yang diizinkan
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // Log origins yang ditolak untuk debugging
        console.warn(`CORS ditolak untuk origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
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