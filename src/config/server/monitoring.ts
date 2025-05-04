import { getInstanceCount } from '../app/port';
import { getMemoryUsage } from './serverOptimizations';
import { config } from '../app/env';

/**
 * Mencetak log server startup
 * @param port Port dimana server berjalan
 */
export const logServerStartup = (port: number): void => {
  const memoryUsage = getMemoryUsage();
  const instanceCount = getInstanceCount();

  console.log(`
  📡 Sport Center API
  -----------------------------
  🔌 Server running on port ${port}
  🌐 API URL: ${config.urls.api}
  🖥️ Frontend URL: ${config.urls.frontend}
  🔄 WebSocket server initialized
  🌍 Environment: ${config.environment}
  🚀 Mode: ${config.isProduction ? 'Production' : 'Development'}
  #️⃣ Instance: ${instanceCount}
  
  💾 Memory Usage:
  - Heap Used: ${Math.round(memoryUsage.heapUsed * 100) / 100}MB
  - Heap Total: ${Math.round(memoryUsage.heapTotal * 100) / 100}MB
  - RSS: ${Math.round(memoryUsage.rss * 100) / 100}MB
  -----------------------------
  `);
};

/**
 * Mencetak status kesehatan sistem
 */
export const logSystemHealth = (): void => {
  const memoryUsage = getMemoryUsage();
  const instanceCount = getInstanceCount();
  const uptime = process.uptime();

  // Konversi ke format yang lebih mudah dibaca
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  console.log(`
  💓 System Health Check
  -----------------------------
  ⏱️ Uptime: ${uptimeString}
  #️⃣ Instance: ${instanceCount}
  💾 Memory Usage:
  - Heap Used: ${Math.round(memoryUsage.heapUsed * 100) / 100}MB (${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 10000) / 100}%)
  - Heap Total: ${Math.round(memoryUsage.heapTotal * 100) / 100}MB
  - RSS: ${Math.round(memoryUsage.rss * 100) / 100}MB
  -----------------------------
  `);
};

/**
 * Melakukan health check secara periodik
 * @param intervalMinutes Interval dalam menit
 * @returns Timer untuk health check
 */
export const setupPeriodicHealthCheck = (intervalMinutes: number = 15): any => {
  // Convert to milliseconds
  const interval = intervalMinutes * 60 * 1000;
  return setInterval(logSystemHealth, interval);
};
