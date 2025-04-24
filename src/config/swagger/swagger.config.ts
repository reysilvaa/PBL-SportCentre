import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { Application } from 'express';

/**
 * Fungsi untuk mengatur Swagger UI pada aplikasi Express
 * @param app - Aplikasi Express
 */
export const setupSwagger = (app: Application): void => {
  try {
    // Membaca file swagger.json dari root proyek
    const swaggerJsonPath = path.resolve(process.cwd(), 'swagger.json');
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerJsonPath, 'utf8'));

    // Mengatur opsi untuk Swagger UI
    const options = {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'API Reservasi Sport Center - Dokumentasi',
      customfavIcon: '/favicon.ico',
    };

    // Menetapkan endpoint untuk dokumentasi Swagger
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

    console.log('Swagger dokumentasi berhasil dimuat di /api-docs');
  } catch (error) {
    console.error('Gagal memuat dokumentasi Swagger:', error);
  }
}; 