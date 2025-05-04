/**
 * Konfigurasi ekspor yang terorganisir
 * Memudahkan penggunaan import dengan menyediakan satu entry point
 */

// Ekspor config dasar
export * from './app/env';

// Core modules
export * from './app/port';
export * from './app/logger';
export * from './server/socket';

// Middleware dan security
export * from './server/middleware';
export * from './server/security';

// Server Optimizations (caching, memori, dll)
export * from './server/serverOptimizations';
export * from './server/monitoring';
export * from './server/index';

// Service connections
export * from './services/database';
export * from './services/cloudinary';
export * from './services/midtrans';

// Nama dan versi aplikasi
export const APP_INFO = {
  name: 'Sport Center API',
  version: '1.0.0',
};
