import { Queue, QueueEvents, Worker } from 'bullmq';
import { config } from '../index';
import { KEYS, NAMESPACE, isRedissTLS } from './redis';

// Log konfigurasi Redis untuk debugging
console.log('Redis config for BullMQ Queue:', JSON.stringify(config.redis));
console.log('Redis namespace for BullMQ:', NAMESPACE.QUEUE);
console.log('Redis key for BullMQ:', KEYS.QUEUE.BULL);

/**
 * Konfigurasi koneksi Redis untuk BullMQ yang bisa digunakan di seluruh aplikasi
 * Gunakan URL langsung tanpa parsing untuk menghindari masalah
 */
export const connection = {
  url: config.redis.url,
  tls: isRedissTLS() ? { rejectUnauthorized: false } : undefined
};
/**
 * Konfigurasi default untuk semua queue
 */
export const defaultQueueOptions = {
  connection,
  prefix: NAMESPACE.QUEUE,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: false,
    removeOnFail: false,
  }
};

// Queue untuk membersihkan booking yang kedaluwarsa
export const bookingCleanupQueue = new Queue(NAMESPACE.CLEANUP, defaultQueueOptions);

// Queue untuk memperbarui ketersediaan lapangan secara real-time
export const fieldAvailabilityQueue = new Queue(NAMESPACE.AVAILABILITY, defaultQueueOptions);

// Queue untuk menandai booking yang sudah selesai
export const completedBookingQueue = new Queue(NAMESPACE.COMPLETED, defaultQueueOptions);

// Queue untuk menandai booking yang aktif
export const activeBookingQueue = new Queue(NAMESPACE.ACTIVE, defaultQueueOptions);

/**
 * Setup event listeners untuk monitoring queue
 */
export const setupQueueEvents = (queueName: string) => {
  const queueEvents = new QueueEvents(queueName, { connection });
  
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`❌ Job gagal di queue ${queueName}:`, jobId, failedReason);
  });
  
  queueEvents.on('completed', ({ jobId }) => {
    console.log(`✅ Job selesai di queue ${queueName}:`, jobId);
  });
  
  queueEvents.on('error', (error) => {
    console.error(`🔥 Error dalam queue events ${queueName}:`, error);
  });
  
  return queueEvents;
};

// Setup event listeners untuk semua queue
const bookingCleanupEvents = setupQueueEvents(NAMESPACE.CLEANUP);
const fieldAvailabilityEvents = setupQueueEvents(NAMESPACE.AVAILABILITY);
const completedBookingEvents = setupQueueEvents(NAMESPACE.COMPLETED);
const activeBookingEvents = setupQueueEvents(NAMESPACE.ACTIVE);


export const setupAllProcessors = (
  cleanupHandler: () => Promise<void>,
  completedBookingHandler: () => Promise<void>,
  activeBookingHandler: () => Promise<void>,
  fieldAvailabilityHandler: () => Promise<any>
) => {
  // Mapping nama queue dengan handler function
  const queueHandlers = {
    [NAMESPACE.CLEANUP]: cleanupHandler,
    [NAMESPACE.COMPLETED]: completedBookingHandler,
    [NAMESPACE.ACTIVE]: activeBookingHandler,
    [NAMESPACE.AVAILABILITY]: fieldAvailabilityHandler
  };
  
  Object.entries(queueHandlers).forEach(([queueName, handler]) => {
    setupGenericProcessor(queueName, handler);
  });
};

/**
 * Setup processor generik untuk semua queue
 */
export const setupGenericProcessor = (queueName: string, handler: () => Promise<any>): void => {
  try {
    // Proses job dengan Worker
    const worker = new Worker(queueName, async (job) => {
      console.log(`⏰ Running automatic job processing for ${queueName}, job ID: ${job.id}`);
      await handler();
      console.log(`✅ Completed job processing for ${queueName}, job ID: ${job.id}`);
      return { success: true, timestamp: new Date() };
    }, { connection });

    worker.on('completed', (job) => {
      console.log(`✅ Job selesai di ${queueName} worker: ${job.id}`);
    });

    worker.on('error', (error) => {
      console.error(`❌ Error dalam ${queueName} worker:`, error);
    });

    console.log(`✅ ${queueName} processor didaftarkan`);
  } catch (error) {
    console.error(`❌ Error saat setup ${queueName} processor:`, error);
  }
};

/**
 * Start semua background jobs
 */
export const startAllBackgroundJobs = async (): Promise<void> => {
  await startBookingCleanupJob();
  await startCompletedBookingJob();
  await startActiveBookingJob();
  await startFieldAvailabilityJob();
};

/**
 * Start booking cleanup job that runs every 1 minute
 */
export const startBookingCleanupJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting booking cleanup job with Redis config:', JSON.stringify({
      url: connection.url
    }));
    
    // Menjalankan proses cleanup segera
    const initialJob = await bookingCleanupQueue.add('cleanup', 
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-cleanup' }
    );
    console.log(`Initial cleanup job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await bookingCleanupQueue.add('cleanup',
      { timestamp: new Date().toISOString() },
      {
        jobId: 'cleanup-recurring',
        repeat: { pattern: '* * * * *' }, // Cron: setiap 1 menit
      }
    );
    console.log(`Recurring cleanup job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await bookingCleanupQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in cleanup queue: ${JSON.stringify(repeatableJobs)}`);
    
    // Cek semua job yang terdaftar
    const allJobs = await bookingCleanupQueue.getJobs();
    console.log(`Total jobs in cleanup queue: ${allJobs.length}`);

    console.log(`🚀 ${NAMESPACE.CLEANUP} BullMQ Queue job started - runs every minute`);
  } catch (error) {
    console.error('❌ Error starting booking cleanup job:', error);
  }
};

/**
 * Start completed booking job that runs every 1 minute
 */
export const startCompletedBookingJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting completed booking job with Redis config:', JSON.stringify({
      url: connection.url
    }));
    
    // Menjalankan proses completed booking segera
    const initialJob = await completedBookingQueue.add('complete-bookings',
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-completed-booking' }
    );
    console.log(`Initial completed booking job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await completedBookingQueue.add('complete-bookings',
      { timestamp: new Date().toISOString() },
      {
        jobId: 'completed-booking-recurring',
        repeat: { pattern: '* * * * *' }, // Cron: setiap 1 menit
      }
    );
    console.log(`Recurring completed booking job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await completedBookingQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in completed booking queue: ${JSON.stringify(repeatableJobs)}`);

    console.log(`🚀 ${NAMESPACE.COMPLETED} BullMQ Queue job started - runs every minute`);
  } catch (error) {
    console.error('❌ Error starting completed booking job:', error);
  }
};

/**
 * Start active booking job that runs every minute
 */
export const startActiveBookingJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting active booking job with Redis config:', JSON.stringify({
      url: connection.url
    }));
    
    // Menjalankan proses active booking segera
    const initialJob = await activeBookingQueue.add('activate-bookings',
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-active-booking' }
    );
    console.log(`Initial active booking job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await activeBookingQueue.add('activate-bookings',
      { timestamp: new Date().toISOString() },
      {
        jobId: 'active-booking-recurring',
        repeat: { pattern: '* * * * *' }, // Cron: setiap 1 menit
      }
    );
    console.log(`Recurring active booking job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await activeBookingQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in active booking queue: ${JSON.stringify(repeatableJobs)}`);

    console.log(`🚀 ${NAMESPACE.ACTIVE} BullMQ Queue job started - runs every minute`);
  } catch (error) {
    console.error('❌ Error starting active booking job:', error);
  }
};

/**
 * Start field availability job that runs every minute
 */
export const startFieldAvailabilityJob = (): void => {
  try {
    // Jalankan pembaruan pertama segera
    fieldAvailabilityQueue.add('availability-update', 
      { timestamp: new Date().toISOString() }, 
      { jobId: 'initial-update' }
    );

    // Tambahkan recurring job (setiap 1 menit)
    fieldAvailabilityQueue.add(
      'availability-update',
      { timestamp: new Date().toISOString() },
      {
        jobId: 'availability-recurring',
        repeat: { pattern: '* * * * *' }, // Cron: setiap 1 menit
      }
    );

    console.log(`🚀 ${NAMESPACE.AVAILABILITY} BullMQ Queue job started - runs every minute`);
  } catch (error) {
    console.error('❌ Error starting field availability job:', error);
  }
};

/**
 * Stop semua background jobs
 */
export const stopAllBackgroundJobs = async (): Promise<void> => {
  await stopBookingCleanupJob();
  await stopCompletedBookingJob();
  await stopActiveBookingJob();
  await stopFieldAvailabilityJob();
};

/**
 * Stop booking cleanup job
 */
export const stopBookingCleanupJob = async (): Promise<void> => {
  try {
    await bookingCleanupQueue.close();
    console.log('🛑 Expired booking cleanup BullMQ Queue job stopped');
  } catch (error) {
    console.error('Error stopping booking cleanup job:', error);
  }
};

/**
 * Stop completed booking job
 */
export const stopCompletedBookingJob = async (): Promise<void> => {
  try {
    await completedBookingQueue.close();
    console.log('🛑 Completed booking BullMQ Queue job stopped');
  } catch (error) {
    console.error('Error stopping completed booking job:', error);
  }
};

/**
 * Stop active booking job
 */
export const stopActiveBookingJob = async (): Promise<void> => {
  try {
    await activeBookingQueue.close();
    console.log('🛑 Active booking BullMQ Queue job stopped');
  } catch (error) {
    console.error('Error stopping active booking job:', error);
  }
};

/**
 * Stop field availability job
 */
export const stopFieldAvailabilityJob = async (): Promise<void> => {
  try {
    await fieldAvailabilityQueue.close();
    console.log('🛑 Field availability BullMQ Queue job stopped');
  } catch (error) {
    console.error('Error stopping field availability job:', error);
  }
};

console.info(`🚀 BullMQ Queue siap digunakan dengan Redis (${isRedissTLS() ? 'TLS' : 'non-TLS'}) - Prefix: ${NAMESPACE.QUEUE}`);

// Export event listeners untuk digunakan di tempat lain jika diperlukan
export const queueEvents = {
  bookingCleanupEvents,
  fieldAvailabilityEvents,
  completedBookingEvents,
  activeBookingEvents
};
