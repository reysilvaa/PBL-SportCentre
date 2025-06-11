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
import { handleFieldAvailabilityUpdate } from '../../controllers/availability.controller';
import { logServerStartup, setupPeriodicHealthCheck } from './monitoring';
import { setupSwagger } from '../swagger/swagger.config';
import {
  handleBookingCleanup,
  handleCompletedBooking,
  handleActiveBooking
} from '../../utils/booking/booking-scheduler.utils';
import {
  bookingCleanupQueue,
  completedBookingQueue,
  activeBookingQueue,
  fieldAvailabilityQueue,
  setupAllProcessors,
  startAllBackgroundJobs
} from '../services/queue';
import { initializeCloudinary } from '../services/cloudinary';
import { ensureConnection } from '../services/redis';
import { config } from '../app/env';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

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
  
  checkRedisAndSetupQueues().catch(error => {
    console.error('❌ Error saat inisialisasi Bull Queue:', error);
  });
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
  
  // Setup Bull Board untuk monitoring queue
  setupBullBoard(app);

  // Cek koneksi Redis sebelum setup Bull Queue
  // Jalankan secara async, tapi tidak perlu menunggu hasilnya

  return server;
};

/**
 * Setup Bull Board untuk monitoring queue
 */
export const setupBullBoard = (app: Application): void => {
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(completedBookingQueue),
        new BullMQAdapter(activeBookingQueue),
        new BullMQAdapter(bookingCleanupQueue),
        new BullMQAdapter(fieldAvailabilityQueue)
      ],
      serverAdapter
    });

    app.use('/admin/queues', serverAdapter.getRouter());
    console.log('✅ Bull Board monitoring UI tersedia di /admin/queues');
  } catch (error) {
    console.error('❌ Error saat setup Bull Board:', error);
  }
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
      await startAllBackgroundJobs();
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
    // Setup semua processor dengan handler functions
    setupAllProcessors(
      handleBookingCleanup,
      handleCompletedBooking,
      handleActiveBooking,
      handleFieldAvailabilityUpdate
    );

    console.log('✅ BullMQ processors telah didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup BullMQ processors:', error);
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
