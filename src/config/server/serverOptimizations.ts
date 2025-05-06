import express, { Application } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cluster from 'cluster';
import { Server as SocketServer } from 'socket.io';

/**
 * Konfigurasi pengoptimalan memori
 */
export const setupMemoryOptimization = (): void => {
  // Optimasi V8 Engine
  const v8 = require('v8');
  v8.setFlagsFromString('--max-old-space-size=200');

  // Aktifkan garbage collection manual setiap 2 menit
  const GC_INTERVAL = 120000;
  setInterval(() => {
    if (global.gc) {
      global.gc();
    }
  }, GC_INTERVAL);
};

/**
 * Rate limiting untuk aplikasi
 */
export const createRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // limit setiap IP ke 100 request per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Terlalu banyak permintaan dari IP ini, coba lagi nanti',
  });
};

/**
 * Setup optimasi performa untuk aplikasi
 */
export const setupPerformanceOptimizations = (app: Application): void => {
  // Middleware optimasi performa
  app.use(compression()); // Kompresi respons HTTP
  app.use(helmet()); // Keamanan header
  app.use(createRateLimiter()); // Rate limiting
};

/**
 * Setup optimasi socket
 */
export const setupSocketOptimizations = (io: SocketServer): void => {
  // Optimasi Socket.IO
  (io as any).engine.maxPayload = 50000; // Turunkan batas payload
  (io as any).engine.pingTimeout = 20000; // Turunkan timeout
  (io as any).engine.pingInterval = 25000; // Tingkatkan interval
};

/**
 * Setup cluster untuk multi-core processing di PM2
 */
export const setupCluster = (): void => {
  if (cluster.isMaster) {
    const numCPUs = require('os').cpus().length;
    for (let i = 0; i < Math.min(numCPUs, 2); i++) {
      cluster.fork();
    }
  }
};

/**
 * Setup HTTP caching untuk API routes (browser caching)
 */
export const setupHttpCaching = () => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // Cache selama 5 menit
    res.set('Cache-Control', 'public, max-age=300');
    next();
  };
};

/**
 * Mendapatkan informasi penggunaan memori
 */
export const getMemoryUsage = (): {
  heapUsed: number;
  heapTotal: number;
  rss: number;
} => {
  const memoryUsage = process.memoryUsage();
  return {
    heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
    heapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
    rss: memoryUsage.rss / 1024 / 1024, // MB
  };
};

/**
 * Setup availability updates dengan interval optimum
 */
export const createAvailabilityUpdateInterval = (
  updateFunction: Function
): any => {
  const AVAILABILITY_UPDATE_INTERVAL = 60000; // 60 detik
  return setInterval(updateFunction, AVAILABILITY_UPDATE_INTERVAL);
}; 