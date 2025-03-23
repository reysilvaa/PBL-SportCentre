import { Request, Response } from 'express';
import { getIO } from '../../config/server/socket';
import {
  isFieldAvailable,
  getAllFieldsAvailability,
  getAvailableTimeSlots,
} from '../../utils/booking/checkAvailability.utils';

export const checkAllFieldsAvailability = async (
  req: Request,
  res: Response,
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

// Variable to store update interval reference
let updateIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the interval for real-time hourly updates
 */
export const startFieldAvailabilityUpdates = () => {
  // Set up interval for real-time hourly updates
  if (!updateIntervalId) {
    updateIntervalId = setInterval(async () => {
      try {
        const io = getIO();
        const results = await getAllFieldsAvailability();
        io.of('/fields').emit('fieldsAvailabilityUpdate', results);
        console.log('🔄 Emitted real-time field availability update');
      } catch (error) {
        console.error('Error in scheduled field availability update:', error);
      }
    }, 60 * 1000); // Check every minute
  }
};

/**
 * Clean up resources when shutting down
 */
export const cleanupFieldAvailabilityUpdates = () => {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
};
