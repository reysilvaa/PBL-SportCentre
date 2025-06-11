import { Request, Response } from 'express';
import { emitFieldAvailabilityUpdate } from '../config/server/socket';
import { getAllFieldsAvailability } from '../utils/booking/checkAvailability.utils';

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
    
    // console.log('🔍 Checking availability with date parameter:', selectedDate || 'Not provided (using today)');
    
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
 * Handler untuk pembaruan ketersediaan lapangan
 * Digunakan oleh queue processor
 */
export const handleFieldAvailabilityUpdate = async (): Promise<any> => {
  const results = await getAllFieldsAvailability();
  
  // Emit update real-time melalui socket.io
  if (results && results.length > 0) {
    emitFieldAvailabilityUpdate(results);
  }
  
  return results;
};
