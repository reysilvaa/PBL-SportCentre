/**
 * Konfigurasi ekspor yang terorganisir
 * Memudahkan penggunaan import dengan menyediakan satu entry point
 */

// Export dari konfigurasi aplikasi
export * from './app/env';
export * from './app/logger';
export * from './app/port';

// Export dari konfigurasi server
export * from './server/index';
export * from './server/middleware';
export * from './server/monitoring';
export * from './server/security';
export * from './server/serverOptimizations';
export * from './server/socket';
export * from './server/cors';

// Export dari konfigurasi swagger
export * from './swagger/swagger.config';

// Export dari konfigurasi services
export * from './services/cloudinary';

// Nama dan versi aplikasi
export const APP_INFO = {
  name: 'Sport Center API',
  version: '1.0.0',
};
