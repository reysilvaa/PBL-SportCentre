import Bull from 'bull';
import { config } from '../../config/app/env';
import { updateCompletedBookings, updateActiveBookings, cleanupPendingBookings } from './booking.utils';
import { bookingCleanupQueue as queue } from '../../config/services/queue';

/**
 * Declare queue variables
 */
export const completedBookingQueue = new Bull('completed-booking-queue', {
  redis: config.redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const activeBookingQueue = new Bull('active-booking-queue', {
  redis: config.redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const bookingCleanupQueue = queue;

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
export const startBookingCleanupJob = (): void => {
  try {
    // Menjalankan proses cleanup segera
    bookingCleanupQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-cleanup' }
    );

    // Tambahkan recurring job (setiap 1 menit)
    bookingCleanupQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'cleanup-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );

    console.log('🚀 Expired booking cleanup Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('Error starting booking cleanup job:', error);
  }
};

/**
 * Start completed booking job that runs every 1 minute
 */
export const startCompletedBookingJob = (): void => {
  try {
    // Menjalankan proses completed booking segera
    completedBookingQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-completed-booking' }
    );

    completedBookingQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'completed-booking-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );

    console.log('🚀 Completed booking Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('Error starting completed booking job:', error);
  }
};

/**
 * Start the active booking job that runs every minute
 */
export const startActiveBookingJob = (): void => {
  try {
    // Menjalankan proses active booking segera
    activeBookingQueue.add(
      { timestamp: new Date().toISOString() },
      { jobId: 'initial-active-booking' }
    );

    // Tambahkan recurring job (setiap 1 menit)
    activeBookingQueue.add(
      { timestamp: new Date().toISOString() },
      {
        jobId: 'active-booking-recurring',
        repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
      }
    );

    console.log('🚀 Active booking Bull Queue job started - runs every minute');
  } catch (error) {
    console.error('Error starting active booking job:', error);
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