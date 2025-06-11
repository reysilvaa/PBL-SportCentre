import { updateCompletedBookings, updateActiveBookings, cleanupPendingBookings } from './booking.utils';
import { 
  bookingCleanupQueue,
  completedBookingQueue,
  activeBookingQueue
} from '../../config/services/queue';

/**
 * Export queue untuk digunakan di tempat lain
 */
export { bookingCleanupQueue, completedBookingQueue, activeBookingQueue };

/**
 * Handler untuk booking cleanup
 */
export const handleBookingCleanup = async (): Promise<void> => {
  console.log('🧹 Running booking cleanup handler...');
  await cleanupPendingBookings();
  console.log('✅ Booking cleanup handler completed');
};

/**
 * Handler untuk completed booking
 */
export const handleCompletedBooking = async (): Promise<void> => {
  console.log('🧹 Running completed booking handler...');
  await updateCompletedBookings();
  console.log('✅ Completed booking handler completed');
};

/**
 * Handler untuk active booking
 */
export const handleActiveBooking = async (): Promise<void> => {
  console.log('🧹 Running active booking handler...');
  await updateActiveBookings();
  console.log('✅ Active booking handler completed');
};

/**
 * Fungsi untuk menjalankan semua handler secara manual
 * Berguna untuk debugging atau menjalankan proses secara manual
 */
export const runAllHandlersManually = async (): Promise<void> => {
  console.log('🚀 Running all handlers manually...');
  
  try {
    console.log('🧹 Starting booking cleanup...');
    await handleBookingCleanup();
    console.log('✅ Booking cleanup completed');
    
    console.log('🧹 Starting completed booking update...');
    await handleCompletedBooking();
    console.log('✅ Completed booking update completed');
    
    console.log('🧹 Starting active booking update...');
    await handleActiveBooking();
    console.log('✅ Active booking update completed');
    
    console.log('🎉 All handlers completed successfully');
  } catch (error) {
    console.error('❌ Error running handlers manually:', error);
  }
};