import { CorsOptions } from 'cors';
import { config } from '../app/env';

/**
 * Fungsi untuk mendapatkan konfigurasi CORS standar
 * yang dapat digunakan bersama oleh Express dan Socket.IO
 */
export const corsConfig = (): CorsOptions => {
  return {
    origin: [
      config.urls.frontend,
      'http://localhost:3000',
      'http://localhost:3001',
      '*',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'If-None-Match'],
    exposedHeaders: ['Content-Length', 'Content-Type', 'ETag', 'Cache-Control'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
}; 