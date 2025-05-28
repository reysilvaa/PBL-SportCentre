import Queue from 'bull';
import { config } from '../index';
import { KEYS, NAMESPACE } from './redis';

const redisConfig = {
  redis: {
    url: config.redis.url,
    password: config.redis.password || undefined,
    retryStrategy: (times: number) => {
      if (times > 20) {
        console.error('Bull: Terlalu banyak percobaan koneksi Redis. Tidak akan mencoba lagi.');
        return null;
      }
      
      const delay = Math.min(Math.pow(2, times) * 50, 10000);
      console.log(`Bull: Mencoba koneksi Redis ulang dalam ${delay}ms... (percobaan ke-${times + 1})`);
      return delay;
    },
    maxRetriesPerRequest: 5
  },
  prefix: NAMESPACE.PREFIX || 'sportcenter',
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  }
};

// Queue untuk membersihkan booking yang kedaluwarsa
export const bookingCleanupQueue = new Queue(NAMESPACE.CLEANUP || 'cleanup-expired-bookings', {
  ...redisConfig,
  // Gunakan key yang lengkap dengan namespace dan prefix
  prefix: KEYS?.QUEUE?.CLEANUP?.replace(`:${NAMESPACE.CLEANUP || 'cleanup-expired-bookings'}`, '') || 'sportcenter'
});

// Queue untuk memperbarui ketersediaan lapangan secara real-time
export const fieldAvailabilityQueue = new Queue(NAMESPACE.AVAILABILITY || 'field-availability-updates', {
  ...redisConfig,
  // Gunakan key yang lengkap dengan namespace dan prefix
  prefix: KEYS?.QUEUE?.AVAILABILITY?.replace(`:${NAMESPACE.AVAILABILITY || 'field-availability-updates'}`, '') || 'sportcenter'
});

// Log event untuk memantau queue
const setupQueueMonitoring = (queue: Queue.Queue) => {
  queue.on('completed', (job) => {
    console.info(`✅ Job ${job.id} dalam queue ${queue.name} berhasil diselesaikan`);
  });

  queue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} dalam queue ${queue.name} gagal dengan error:`, err);
  });

  queue.on('error', (error) => {
    console.error(`🔥 Error dalam queue ${queue.name}:`, error);
  });
};

// Setup monitoring untuk semua queue
setupQueueMonitoring(bookingCleanupQueue);
setupQueueMonitoring(fieldAvailabilityQueue);

console.info(`🚀 Bull Queue siap digunakan dengan Redis - Namespace: ${NAMESPACE.PREFIX || 'sportcenter'}`);
