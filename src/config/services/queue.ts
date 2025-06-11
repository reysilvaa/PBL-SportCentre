import { Queue, QueueEvents, Worker } from 'bullmq';
import { config } from '../index';
import { KEYS, NAMESPACE, isRedissTLS } from './redis';

// Log konfigurasi Redis untuk debugging
console.log('Redis config for BullMQ Queue:', JSON.stringify(config.redis));
console.log('Redis namespace for BullMQ:', NAMESPACE.BULL);
console.log('Redis key for BullMQ:', KEYS.QUEUE.BULL);

/**
 * Parse URL Redis dengan benar untuk mendapatkan host dan port
 */
export const parseRedisUrl = (url: string) => {
  // Hapus protokol jika ada
  let cleanUrl = url;
  if (url.startsWith('redis://')) {
    cleanUrl = url.substring(8);
  } else if (url.startsWith('rediss://')) {
    cleanUrl = url.substring(9);
  }
  
  // Pisahkan host:port
  if (cleanUrl.includes(':')) {
    const [host, portStr] = cleanUrl.split(':');
    const port = parseInt(portStr);
    
    // Pastikan port valid
    if (isNaN(port)) {
      console.error('❌ Port tidak valid dalam URL Redis:', portStr);
      return { host, port: 6379 };
    }
    
    return { host, port };
  }
  
  // Default jika format tidak sesuai
  return { host: cleanUrl, port: 6379 };
};

// Parse konfigurasi Redis
const redisUrlParsed = parseRedisUrl(config.redis.url);
console.log('Parsed Redis URL:', JSON.stringify({
  host: redisUrlParsed.host,
  port: redisUrlParsed.port
}));

/**
 * Konfigurasi koneksi Redis untuk BullMQ yang bisa digunakan di seluruh aplikasi
 */
export const connection = {
  host: redisUrlParsed.host,
  port: redisUrlParsed.port,
  tls: isRedissTLS() ? { rejectUnauthorized: false } : undefined,
  db: 0
};

/**
 * Konfigurasi default untuk semua queue
 */
export const defaultQueueOptions = {
  connection,
  prefix: 'bullmq',
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
  }
};

// Queue untuk membersihkan booking yang kedaluwarsa
export const bookingCleanupQueue = new Queue('cleanup-expired-bookings', defaultQueueOptions);

// Queue untuk memperbarui ketersediaan lapangan secara real-time
export const fieldAvailabilityQueue = new Queue('field-availability-updates', defaultQueueOptions);

// Queue untuk menandai booking yang sudah selesai
export const completedBookingQueue = new Queue('completed-booking-queue', defaultQueueOptions);

// Queue untuk menandai booking yang aktif
export const activeBookingQueue = new Queue('active-booking-queue', defaultQueueOptions);

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
const bookingCleanupEvents = setupQueueEvents('cleanup-expired-bookings');
const fieldAvailabilityEvents = setupQueueEvents('field-availability-updates');
const completedBookingEvents = setupQueueEvents('completed-booking-queue');
const activeBookingEvents = setupQueueEvents('active-booking-queue');

/**
 * Setup processor untuk semua queue
 */
export const setupAllProcessors = (
  cleanupHandler: () => Promise<void>,
  completedBookingHandler: () => Promise<void>,
  activeBookingHandler: () => Promise<void>,
  fieldAvailabilityHandler: () => Promise<any>
) => {
  setupBookingCleanupProcessor(cleanupHandler);
  setupCompletedBookingProcessor(completedBookingHandler);
  setupActiveBookingProcessor(activeBookingHandler);
  setupFieldAvailabilityProcessor(fieldAvailabilityHandler);
};

/**
 * Setup processor untuk booking cleanup queue
 */
export const setupBookingCleanupProcessor = (handler: () => Promise<void>): void => {
  try {
    // Proses job dengan Worker
    const worker = new Worker('cleanup-expired-bookings', async () => {
      console.log('⏰ Running automatic expired booking processing');
      await handler();
      return { success: true, timestamp: new Date() };
    }, { connection });

    worker.on('error', (error) => {
      console.error('❌ Error dalam booking cleanup worker:', error);
    });

    console.log('✅ Booking cleanup processor didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup booking cleanup processor:', error);
  }
};

/**
 * Setup processor untuk completed booking queue
 */
export const setupCompletedBookingProcessor = (handler: () => Promise<void>): void => {
  try {
    // Proses job dengan Worker
    const worker = new Worker('completed-booking-queue', async () => {
      console.log('⏰ Running automatic completed booking processing');
      await handler();
      return { success: true, timestamp: new Date() };
    }, { connection });

    worker.on('error', (error) => {
      console.error('❌ Error dalam completed booking worker:', error);
    });

    console.log('✅ Completed booking processor didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup completed booking processor:', error);
  }
};

/**
 * Setup processor untuk active booking queue
 */
export const setupActiveBookingProcessor = (handler: () => Promise<void>): void => {
  try {
    // Proses job dengan Worker
    const worker = new Worker('active-booking-queue', async () => {
      console.log('⏰ Running automatic active booking processing');
      await handler();
      return { success: true };
    }, { connection });

    worker.on('error', (error) => {
      console.error('❌ Error dalam active booking worker:', error);
    });

    console.log('✅ Active booking processor setup complete');
  } catch (error) {
    console.error('Error setting up active booking processor:', error);
  }
};

/**
 * Setup processor untuk field availability queue
 */
export const setupFieldAvailabilityProcessor = (handler: () => Promise<any>): void => {
  try {
    // Proses job dengan Worker
    const worker = new Worker('field-availability-updates', async () => {
      try {
        await handler();
        console.log('🔄 Field availability update processed');
        return { success: true, timestamp: new Date() };
      } catch (error) {
        console.error('Error in scheduled field availability update:', error);
        throw error;
      }
    }, { connection });

    worker.on('error', (error) => {
      console.error('❌ Error dalam field availability worker:', error);
    });

    console.log('✅ Field availability processor didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup field availability processor:', error);
  }
};

/**
 * Start semua background jobs
 */
export const startAllBackgroundJobs = async (): Promise<void> => {
  await startBookingCleanupJob();
  await startCompletedBookingJob();
  await startActiveBookingJob();
  startFieldAvailabilityJob();
};

/**
 * Start booking cleanup job that runs every 1 minute
 */
export const startBookingCleanupJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting booking cleanup job with Redis config:', JSON.stringify({
      host: connection.host,
      port: connection.port
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

    console.log('🚀 Expired booking cleanup BullMQ Queue job started - runs every minute');
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
      host: connection.host,
      port: connection.port
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

    console.log('🚀 Completed booking BullMQ Queue job started - runs every minute');
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
      host: connection.host,
      port: connection.port
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

    console.log('🚀 Active booking BullMQ Queue job started - runs every minute');
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

    console.log('🚀 Field availability BullMQ Queue job started - runs every minute');
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

console.info(`🚀 BullMQ Queue siap digunakan dengan Redis (${isRedissTLS() ? 'TLS' : 'non-TLS'}) - Prefix: bullmq`);

// Export event listeners untuk digunakan di tempat lain jika diperlukan
export const queueEvents = {
  bookingCleanupEvents,
  fieldAvailabilityEvents,
  completedBookingEvents,
  activeBookingEvents
};
