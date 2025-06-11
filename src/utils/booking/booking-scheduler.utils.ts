import Bull from 'bull';
import { config } from '../../config/app/env';
import { updateCompletedBookings, updateActiveBookings, cleanupPendingBookings } from './booking.utils';
import { bookingCleanupQueue as queue } from '../../config/services/queue';
import redisClient, { NAMESPACE, KEYS } from '../../config/services/redis';

// Log konfigurasi Redis untuk debugging
console.log('Redis config for Bull Queue:', JSON.stringify(config.redis));
console.log('Redis namespace for Bull:', NAMESPACE.BULL);
console.log('Redis key for Bull:', KEYS.QUEUE.BULL);

// Gunakan konfigurasi yang konsisten dengan queue.ts
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

/**
 * Declare queue variables
 */
export const completedBookingQueue = new Bull(NAMESPACE.COMPLETED || 'completed-booking-queue', redisConfig);

export const activeBookingQueue = new Bull(NAMESPACE.ACTIVE || 'active-booking-queue', redisConfig);

export const bookingCleanupQueue = queue;

// Tambahkan event listeners untuk error handling
completedBookingQueue.on('error', (error) => {
  console.error(`🔥 Error dalam queue ${completedBookingQueue.name}:`, error);
});

activeBookingQueue.on('error', (error) => {
  console.error(`🔥 Error dalam queue ${activeBookingQueue.name}:`, error);
});

// Tambahkan event listener untuk failed jobs
completedBookingQueue.on('failed', (job, err) => {
  console.error(`❌ Job gagal di queue ${completedBookingQueue.name}:`, job.id, err);
});

activeBookingQueue.on('failed', (job, err) => {
  console.error(`❌ Job gagal di queue ${activeBookingQueue.name}:`, job.id, err);
});

/**
 * Setup processor for booking cleanup job
 */
export const setupBookingCleanupProcessor = (): void => {
  try {
    // Proses job
    bookingCleanupQueue.process(async () => {
      console.log('⏰ Running automatic expired booking processing');
      await cleanupPendingBookings();
      return { success: true, timestamp: new Date() };
    });

    console.log('✅ Booking cleanup processor didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup booking cleanup processor:', error);
  }
};

/**
 * Setup processor for completed booking job
 */
export const setupCompletedBookingProcessor = (): void => {
  try {
    // Proses job
    completedBookingQueue.process(async () => {
      console.log('⏰ Running automatic completed booking processing');
      await updateCompletedBookings();
      return { success: true, timestamp: new Date() };
    });

    console.log('✅ Completed booking processor didaftarkan');
  } catch (error) {
    console.error('❌ Error saat setup completed booking processor:', error);
  }
};

/**
 * Setup processor for active booking queue
 */
export const setupActiveBookingProcessor = (): void => {
  try {
    // Process the queue
    activeBookingQueue.process(async () => {
      await updateActiveBookings();
      return { success: true };
    });

    console.log('✅ Active booking processor setup complete');
  } catch (error) {
    console.error('Error setting up active booking processor:', error);
  }
};

/**
 * Start booking cleanup job that runs every 1 minute
 */
export const startBookingCleanupJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting booking cleanup job with Redis config:', JSON.stringify(config.redis));
    
    // Cek apakah Redis terhubung
    const isConnected = await redisClient.ping();
    console.log(`Redis ping result for cleanup job: ${isConnected}`);
    
    // Menjalankan proses cleanup segera
    const initialJob = await bookingCleanupQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-cleanup' }
    );
    console.log(`Initial cleanup job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await bookingCleanupQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'cleanup-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );
    console.log(`Recurring cleanup job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await bookingCleanupQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in cleanup queue: ${JSON.stringify(repeatableJobs)}`);

    console.log('🚀 Expired booking cleanup Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('❌ Error starting booking cleanup job:', error);
  }
};

/**
 * Start completed booking job that runs every 1 minute
 */
export const startCompletedBookingJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting completed booking job with Redis config:', JSON.stringify(config.redis));
    
    // Cek apakah Redis terhubung
    const isConnected = await redisClient.ping();
    console.log(`Redis ping result for completed job: ${isConnected}`);
    
    // Menjalankan proses completed booking segera
    const initialJob = await completedBookingQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-completed-booking' }
    );
    console.log(`Initial completed booking job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await completedBookingQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'completed-booking-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );
    console.log(`Recurring completed booking job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await completedBookingQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in completed booking queue: ${JSON.stringify(repeatableJobs)}`);

    console.log('🚀 Completed booking Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('❌ Error starting completed booking job:', error);
  }
};

/**
 * Start the active booking job that runs every minute
 */
export const startActiveBookingJob = async (): Promise<void> => {
  try {
    console.log('🔄 Starting active booking job with Redis config:', JSON.stringify(config.redis));
    
    // Cek apakah Redis terhubung
    const isConnected = await redisClient.ping();
    console.log(`Redis ping result for active job: ${isConnected}`);
    
    // Menjalankan proses active booking segera
    const initialJob = await activeBookingQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-active-booking' }
    );
    console.log(`Initial active booking job added with ID: ${initialJob.id}`);

    // Tambahkan recurring job (setiap 1 menit)
    const recurringJob = await activeBookingQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'active-booking-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );
    console.log(`Recurring active booking job added with ID: ${recurringJob.id}`);

    // Cek apakah job terdaftar di Redis
    const repeatableJobs = await activeBookingQueue.getRepeatableJobs();
    console.log(`Repeatable jobs in active booking queue: ${JSON.stringify(repeatableJobs)}`);

    console.log('🚀 Active booking Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('❌ Error starting active booking job:', error);
  }
};

/**
 * Stop the booking cleanup job
 */
export const stopBookingCleanupJob = async (): Promise<void> => {
  try {
    await bookingCleanupQueue.close();
    console.log('🛑 Expired booking cleanup Bull Queue job stopped');
  } catch (error) {
    console.error('Error stopping booking cleanup job:', error);
  }
};

/**
 * Stop the completed booking job
 */
export const stopCompletedBookingJob = async (): Promise<void> => {
  try {
    await completedBookingQueue.close();
    console.log('🛑 Completed booking Bull Queue job stopped');
  } catch (error) {
    console.error('Error stopping completed booking job:', error);
  }
};

/**
 * Stop the active booking job
 */
export const stopActiveBookingJob = async (): Promise<void> => {
  try {
    await activeBookingQueue.close();
    console.log('🛑 Active booking Bull Queue job stopped');
  } catch (error) {
    console.error('Error stopping active booking job:', error);
  }
}; 