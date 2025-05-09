import { Application } from 'express';
import compression from 'compression';
import cluster from 'cluster';
import { Server as SocketServer } from 'socket.io';
import { SOCKET_CONFIG } from './socket';

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
 * Setup optimasi performa untuk aplikasi
 */
export const setupPerformanceOptimizations = (app: Application): void => {
  // Middleware optimasi performa
  app.use(compression()); // Kompresi respons HTTP
};

/**
 * Setup optimasi socket
 */
export const setupSocketOptimizations = (io: SocketServer): void => {
  // Optimasi Socket.IO menggunakan konfigurasi standar
  (io as any).engine.maxPayload = SOCKET_CONFIG.maxPayload;
  (io as any).engine.pingTimeout = SOCKET_CONFIG.pingTimeout;
  (io as any).engine.pingInterval = SOCKET_CONFIG.pingInterval;
};

/**
 * Setup cluster untuk multi-core processing di PM2
 */
export const setupCluster = (): void => {
  if (cluster.isPrimary) {
    const numCPUs = require('os').cpus().length;
    for (let i = 0; i < Math.min(numCPUs, 2); i++) {
      cluster.fork();
    }
  }
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
export const createAvailabilityUpdateInterval = (updateFunction: Function): any => {
  const AVAILABILITY_UPDATE_INTERVAL = 60000; // 60 detik
  return setInterval(updateFunction, AVAILABILITY_UPDATE_INTERVAL);
};
