import { Request, Response } from 'express';
import { getIO } from '../config/server/socket';
import {
  isFieldAvailable,
  getAllFieldsAvailability,
  getAvailableTimeSlots,
} from '../utils/booking/checkAvailability.utils';
import { fieldAvailabilityQueue } from '../config/services/queue';

/**
 * Unified Availability Controller
 * Mengelola endpoint terkait ketersediaan lapangan
 */

export const checkAllFieldsAvailability = async (
  req: Request,
  res: Response
) => {
  try {
    const results = await getAllFieldsAvailability();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error checking all fields availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check all fields availability',
    });
  }
};

/**
 * Setup processor untuk field availability queue
 */
export const setupFieldAvailabilityProcessor = (): void => {
  // Proses job
  fieldAvailabilityQueue.process(async (job) => {
    try {
      const io = getIO();
      const results = await getAllFieldsAvailability();
      io.of('/fields').emit('fieldsAvailabilityUpdate', results);
      console.log('🔄 Emitted real-time field availability update');
      return { success: true, timestamp: new Date() };
    } catch (error) {
      console.error('Error in scheduled field availability update:', error);
      throw error;
    }
  });
  
  console.log('✅ Field availability processor didaftarkan');
};

/**
 * Start Bull Queue jobs untuk pembaruan ketersediaan lapangan
 */
export const startFieldAvailabilityUpdates = (): void => {
  // Jalankan pembaruan pertama segera
  fieldAvailabilityQueue.add({}, { jobId: 'initial-update' });
  
  // Tambahkan recurring job (setiap 1 menit)
  fieldAvailabilityQueue.add({}, {
    jobId: 'availability-recurring',
    repeat: { cron: '*/1 * * * *' }
  });
  
  console.log('🚀 Field availability Bull Queue job started');
};

/**
 * Clean up resources when shutting down
 */
export const cleanupFieldAvailabilityUpdates = async (): Promise<void> => {
  await fieldAvailabilityQueue.close();
  console.log('🛑 Field availability Bull Queue job stopped');
}; 