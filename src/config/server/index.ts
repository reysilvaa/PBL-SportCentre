import { Application } from 'express';
import http from 'http';
import { getPort } from '../app/port';
import {
  setupMemoryOptimization,
  setupPerformanceOptimizations,
  setupSocketOptimizations,
} from './serverOptimizations';
import { setupSecurityMiddlewares } from '../server/security';
import { setupMiddlewares } from '../server/middleware';
import { initializeSocketIO } from '../server/socket';
import { initializeAllSocketHandlers } from '../../socket-handlers';
import {
  startFieldAvailabilityUpdates,
  setupFieldAvailabilityProcessor,
} from '../../controllers/availability.controller';
import { logServerStartup, setupPeriodicHealthCheck } from './monitoring';
import { setupSwagger } from '../swagger/swagger.config';
import {
  startBookingCleanupJob,
  setupBookingCleanupProcessor,
} from '../../utils/booking/booking.utils';
import { initializeCloudinary } from '../services/cloudinary';

/**
 * Inisialisasi semua komponen sebelum server dimulai
 */
export const initializeApplication = (app: Application): http.Server => {
  // Inisialisasi cloudinary
  initializeCloudinary();

  // Inisialisasi optimasi memori
  setupMemoryOptimization();

  // Buat HTTP server
  const server = http.createServer(app);

  // Setup security middlewares
  setupSecurityMiddlewares(app);

  // Setup basic middlewares
  setupMiddlewares(app);

  // Setup optimasi performa
  setupPerformanceOptimizations(app);

  setupSwagger(app);

  // Initialize Socket.IO dan optimalkan
  const io = initializeSocketIO(server);
  setupSocketOptimizations(io);

  // Initialize all socket handlers
  initializeAllSocketHandlers();

  // Setup Bull Queue processors
  setupQueueProcessors();

  // Mulai Bull Queue jobs
  startBackgroundJobs();

  return server;
};

/**
 * Setup Bull Queue processors
 */
export const setupQueueProcessors = (): void => {
  // Setup processor untuk Field Availability queue
  setupFieldAvailabilityProcessor();

  // Setup processor untuk Booking Cleanup queue
  setupBookingCleanupProcessor();

  console.log('✅ Bull Queue processors telah didaftarkan');
};

/**
 * Memulai background jobs dengan Bull Queue
 */
export const startBackgroundJobs = (): void => {
  // Mulai job untuk memperbarui ketersediaan lapangan
  startFieldAvailabilityUpdates();

  // Mulai job untuk membersihkan booking yang kedaluwarsa
  startBookingCleanupJob();

  console.log('🚀 Background jobs dimulai dengan Bull Queue');
};

/**
 * Memulai server dan menjalankan proses startup
 */
export const startServer = (server: http.Server): void => {
  const port = getPort();

  server.listen(port, () => {
    // Log server startup info
    logServerStartup(port);

    // Setup periodic health checks (setiap 15 menit)
    setupPeriodicHealthCheck(15);

    // Kirim sinyal ready ke PM2
    if (process.send) {
      process.send('ready');
    }
  });
};
