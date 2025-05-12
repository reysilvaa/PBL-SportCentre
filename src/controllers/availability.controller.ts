import { Request, Response } from 'express';
import { emitFieldAvailabilityUpdate } from '../config/server/socket';
import { getAllFieldsAvailability } from '../utils/booking/checkAvailability.utils';
import { fieldAvailabilityQueue } from '../config/services/queue';

/**
 * Unified Availability Controller
 * Mengelola endpoint terkait ketersediaan lapangan
 * 
 * CATATAN PENTING TENTANG TIME SLOTS:
 * - Semua endTime bersifat exclusive (tidak termasuk dalam booking)
 * - Contoh: booking 21:00-23:00 berarti slot waktu dari 21:00:00 sampai 22:59:59.999
 * - Slot waktu tersedia berikutnya dimulai pada 23:00:00.000
 */

export const checkAllFieldsAvailability = async (req: Request, res: Response) => {
  try {
    // Ambil parameter tanggal dari query string jika tersedia
    const selectedDate = req.query.date as string | undefined;
    
    console.log('🔍 Checking availability with date parameter:', selectedDate || 'Not provided (using today)');
    
    const results = await getAllFieldsAvailability(selectedDate);
    
    // Jika berhasil mendapatkan data, emit update melalui socket.io
    if (results && results.length > 0) {
      emitFieldAvailabilityUpdate(results, selectedDate);
    }
    
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
  fieldAvailabilityQueue.process(async () => {
    try {
      const results = await getAllFieldsAvailability();
      
      // Emit update real-time melalui socket.io
      emitFieldAvailabilityUpdate(results);
      
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
  fieldAvailabilityQueue.add(
    {},
    {
      jobId: 'availability-recurring',
      repeat: { cron: '*/1 * * * *' },
    }
  );

  console.log('🚀 Field availability Bull Queue job started');
};

/**
 * Clean up resources when shutting down
 */
export const cleanupFieldAvailabilityUpdates = async (): Promise<void> => {
  await fieldAvailabilityQueue.close();
  console.log('🛑 Field availability Bull Queue job stopped');
};
