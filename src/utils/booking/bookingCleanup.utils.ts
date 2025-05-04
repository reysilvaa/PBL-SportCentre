import { PaymentStatus } from '@prisma/client';
import prisma from '../../config/services/database';
import { bookingCleanupQueue } from '../../config/services/queue';

// Define PaymentStatus enum to match Prisma schema
/**
 * Function to mark expired pending bookings as failed
 * Bookings that haven't been paid within 5 minutes after Midtrans confirmation will be marked as failed
 */
export const cleanupPendingBookings = async (): Promise<void> => {
  try {
    // Find payments with 'pending' status that have passed their expiration date
    const currentTime = new Date();

    console.log('🧹 Processing expired pending bookings at:', currentTime);

    // Find expired pending payments
    // Only process ones that have an expiresDate set (meaning they've received Midtrans notification)
    const expiredPayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.pending,
        expiresDate: {
          not: null, // Only process payments that have an expiry date set
          lt: currentTime, // Only process expired payments
        },
      },
      include: {
        booking: true,
      },
    });

    console.log(`🔍 Found ${expiredPayments.length} expired pending payments`);

    // Update the payment status to 'failed' instead of deleting
    for (const payment of expiredPayments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
        },
      });

      console.log(
        `🔄 Updated payment #${payment.id} status to 'failed' for booking #${payment.booking?.id}`
      );

      // You might want to add code here to update your notification system
      // to inform users that their booking has expired
    }

    console.log('✅ Expired booking processing completed');
  } catch (error) {
    console.error('❌ Error in cleanupPendingBookings:', error);
  }
};

/**
 * Definisi processor untuk booking cleanup job
 */
export const setupBookingCleanupProcessor = (): void => {
  // Proses job
  bookingCleanupQueue.process(async (job) => {
    console.log('⏰ Running automatic expired booking processing');
    await cleanupPendingBookings();
    return { success: true, timestamp: new Date() };
  });
  
  console.log('✅ Booking cleanup processor didaftarkan');
};

/**
 * Function to start a Bull Queue job that will automatically process expired bookings
 * Runs every 1 minute
 */
export const startBookingCleanupJob = (): void => {
  // Menjalankan proses cleanup segera
  bookingCleanupQueue.add({}, { jobId: 'initial-cleanup' });
  
  // Tambahkan recurring job (setiap 1 menit)
  bookingCleanupQueue.add({}, {
    jobId: 'cleanup-recurring',
    repeat: { cron: '*/1 * * * *' } // Sama dengan cron: setiap 1 menit
  });
  
  console.log('🚀 Expired booking cleanup Bull Queue job started');
};

/**
 * Function to stop the booking cleanup job
 */
export const stopBookingCleanupJob = async (): Promise<void> => {
  await bookingCleanupQueue.close();
  console.log('🛑 Expired booking cleanup Bull Queue job stopped');
};
