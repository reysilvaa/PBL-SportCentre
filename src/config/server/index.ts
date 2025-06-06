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
import { ensureConnection } from '../services/redis';
import { config } from '../app/env';


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

  // Cek koneksi Redis sebelum setup Bull Queue
  checkRedisAndSetupQueues();

  return server;
};

/**
 * Cek koneksi Redis sebelum setup Bull Queue
 */
export const checkRedisAndSetupQueues = async (): Promise<void> => {
  try {
    // Cek koneksi Redis dengan ping
    const isConnected = await ensureConnection.isConnected();
    
    if (isConnected) {
      console.log(`✅ Redis terhubung ke ${config.redis.url}`);
      
      // Setup Bull Queue processors
      setupQueueProcessors();
      
      // Mulai Bull Queue jobs
      startBackgroundJobs();
    } else {
      console.warn('⚠️ Redis tidak terhubung, menonaktifkan background jobs');
      console.warn('⚠️ Beberapa fitur mungkin tidak berfungsi dengan baik tanpa background jobs');
    }
  } catch (error) {
    console.error('❌ Error saat memeriksa koneksi Redis:', error);
    console.warn('⚠️ Menonaktifkan background jobs karena Redis tidak tersedia');
  }
};

/**
 * Setup Bull Queue processors
 */
export const setupQueueProcessors = (): void => {
  try {
    // Setup processor untuk Field Availability queue
    setupFieldAvailabilityProcessor();

    // Setup processor untuk Booking Cleanup queue
    setupBookingCleanupProcessor();

    console.log('✅ Bull Queue processors telah didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup Bull Queue processors:', error);
  }
};

/**
 * Memulai background jobs dengan Bull Queue
 */
export const startBackgroundJobs = (): void => {
  try {
    // Mulai job untuk memperbarui ketersediaan lapangan
    startFieldAvailabilityUpdates();

    // Mulai job untuk membersihkan booking yang kedaluwarsa
    startBookingCleanupJob();

    console.log('🚀 Background jobs dimulai dengan Bull Queue');
  } catch (error) {
    console.error('❌ Error saat memulai background jobs:', error);
  }
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
