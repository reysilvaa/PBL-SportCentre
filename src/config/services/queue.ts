import Queue from 'bull';
import { config } from '../index';

// Queue untuk membersihkan booking yang kedaluwarsa
export const bookingCleanupQueue = new Queue('booking-cleanup', {
  redis: config.redis.url,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Queue untuk memperbarui ketersediaan lapangan secara real-time
export const fieldAvailabilityQueue = new Queue('field-availability', {
  redis: config.redis.url,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  },
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

console.info('🚀 Bull Queue siap digunakan dengan Redis'); 