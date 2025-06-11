import Queue from 'bull';
import { config } from '../index';
import redisClient, { KEYS, NAMESPACE } from './redis';

// Cek apakah menggunakan Redis TLS (rediss://)
const isRedissTLS = config.redis.url.startsWith('rediss://');

// Log konfigurasi Redis untuk debugging
console.log('Redis config for Bull Queue:', JSON.stringify(config.redis));
console.log('Redis namespace for Bull:', NAMESPACE.BULL);
console.log('Redis key for Bull:', KEYS.QUEUE.BULL);

// Konfigurasi Redis untuk Bull Queue menggunakan instance Redis yang sudah ada
const redisConfig = {
  createClient: (type: string) => {
    console.info(`🔒 Bull Queue menggunakan klien Redis untuk: ${type}`);
    // Gunakan instance Redis yang sudah dibuat di redis.ts
    return redisClient;
  },
  prefix: KEYS.QUEUE.BULL || `${NAMESPACE.PREFIX}:${NAMESPACE.BULL}`,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  }
};

// Queue untuk membersihkan booking yang kedaluwarsa
export const bookingCleanupQueue = new Queue(NAMESPACE.CLEANUP || 'cleanup-expired-bookings', redisConfig);

// Queue untuk memperbarui ketersediaan lapangan secara real-time
export const fieldAvailabilityQueue = new Queue(NAMESPACE.AVAILABILITY || 'field-availability-updates', redisConfig);

// Event listeners untuk error handling
bookingCleanupQueue.on('error', (error) => {
  console.error(`🔥 Error dalam queue ${bookingCleanupQueue.name}:`, error);
});

fieldAvailabilityQueue.on('error', (error) => {
  console.error(`🔥 Error dalam queue ${fieldAvailabilityQueue.name}:`, error);
});

// Tambahkan event listener untuk failed jobs
bookingCleanupQueue.on('failed', (job, err) => {
  console.error(`❌ Job gagal di queue ${bookingCleanupQueue.name}:`, job.id, err);
});

fieldAvailabilityQueue.on('failed', (job, err) => {
  console.error(`❌ Job gagal di queue ${fieldAvailabilityQueue.name}:`, job.id, err);
});

console.info(`🚀 Bull Queue siap digunakan dengan Redis (${isRedissTLS ? 'TLS' : 'non-TLS'}) - Namespace: ${NAMESPACE.PREFIX || 'sportcenter'}`);
