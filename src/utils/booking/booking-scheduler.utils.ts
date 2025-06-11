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
  await cleanupPendingBookings();
};

/**
 * Handler untuk completed booking
 */
export const handleCompletedBooking = async (): Promise<void> => {
  await updateCompletedBookings();
};

/**
 * Handler untuk active booking
 */
export const handleActiveBooking = async (): Promise<void> => {
  await updateActiveBookings();
};