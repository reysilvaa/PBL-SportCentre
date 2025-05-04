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
import { startFieldAvailabilityUpdates } from '../../controllers/all/availability.controller';
import { logServerStartup, setupPeriodicHealthCheck } from './monitoring';
import { setupSwagger } from '../swagger/swagger.config';

/**
 * Inisialisasi semua komponen sebelum server dimulai
 */
export const initializeApplication = (app: Application): http.Server => {
  // Inisialisasi optimasi memori
  setupMemoryOptimization();

  // Buat HTTP server
  const server = http.createServer(app);

  // Setup optimasi performa
  setupPerformanceOptimizations(app);

  // Setup security middlewares
  setupSecurityMiddlewares(app);

  // Setup basic middlewares
  setupMiddlewares(app);

  setupSwagger(app);

  // Initialize Socket.IO dan optimalkan
  const io = initializeSocketIO(server);
  setupSocketOptimizations(io);

  // Initialize all socket handlers
  initializeAllSocketHandlers();

  // Start field availability updates dengan interval yang ditentukan
  startAvailabilityUpdates();

  return server;
};

/**
 * Memulai interval update ketersediaan lapangan
 */
export const startAvailabilityUpdates = (): any => {
  const AVAILABILITY_UPDATE_INTERVAL = 60000; // 60 detik
  return setInterval(
    startFieldAvailabilityUpdates,
    AVAILABILITY_UPDATE_INTERVAL
  );
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
