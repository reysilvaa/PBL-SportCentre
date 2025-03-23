import { PaymentStatus } from '@prisma/client';
import prisma from '../../config/services/database';
import { CronJob } from 'cron';

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
        `🔄 Updated payment #${payment.id} status to 'failed' for booking #${payment.booking?.id}`,
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
 * Function to start a cron job that will automatically process expired bookings
 * Runs every 1 minute
 */
export const startBookingCleanupJob = (): CronJob => {
  // Create a cron job that runs every 1 minute
  const job = new CronJob('*/1 * * * *', async () => {
    console.log('⏰ Running automatic expired booking processing');
    await cleanupPendingBookings();
  });

  // Start the cron job
  job.start();
  console.log('🚀 Expired booking processing cron job started');

  return job;
};
