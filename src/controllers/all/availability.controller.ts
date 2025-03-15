import { Socket } from 'socket.io';
import { getIO, applyAuthMiddleware, setupNamespaceEvents } from '../../config/socket';
import { 
  isFieldAvailable, 
  getAllFieldsAvailability, 
  getAvailableTimeSlots 
} from '../../utils/booking/checkAvailability.utils';
import { Request, Response } from 'express';

export const checkAllFieldsAvailability = async (req: Request, res: Response) => {
  try {
    const results = await getAllFieldsAvailability();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error checking all fields availability:', error);
    res.status(500).json({ success: false, error: 'Failed to check all fields availability' });
  }
};

// Variable to store namespace reference
let fieldNamespace: any = null;

// Set up update interval reference
let updateIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize the field namespace and all its event handlers
 * This will be called when the server is ready
 */
export const initializeFieldNamespace = () => {
  try {
    // Use the global IO instance via getIO()
    const io = getIO();
    fieldNamespace = io.of('/fields');

    // Apply authentication middleware (optional)
    applyAuthMiddleware(fieldNamespace);

    // Set up basic namespace events
    setupNamespaceEvents(fieldNamespace);

    // Set up connection handler for the field namespace
    fieldNamespace.on('connection', (socket: Socket) => {
      // Handle requests for all fields availability
      socket.on('checkAllFieldsAvailability', async (data, callback) => {
        try {
          const results = await getAllFieldsAvailability();
          
          // Send response through callback if provided
          if (typeof callback === 'function') {
            callback({ success: true, data: results });
          }
          
          // Also broadcast to all connected clients
          fieldNamespace.emit('fieldsAvailabilityUpdate', results);
        } catch (error) {
          console.error('Error checking all fields availability:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Failed to check all fields availability' });
          }
        }
      });

      // Handle requests for specific field availability
      socket.on('checkFieldAvailability', async (data, callback) => {
        try {
          const { fieldId, bookingDate, startTime, endTime } = data;
          
          if (!fieldId || !bookingDate || !startTime || !endTime) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Missing required parameters' });
            }
            return;
          }
          
          const start = new Date(startTime);
          const end = new Date(endTime);
          const date = new Date(bookingDate);
          
          const isAvailable = await isFieldAvailable(
            Number(fieldId), 
            date, 
            start, 
            end
          );
          
          if (typeof callback === 'function') {
            callback({ success: true, data: { isAvailable } });
          }
        } catch (error) {
          console.error('Error checking field availability:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Failed to check field availability' });
          }
        }
      });

      // Handle requests for available time slots
      socket.on('getAvailableTimeSlots', async (data, callback) => {
        try {
          const { fieldId, date } = data;
          
          if (!fieldId || !date) {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Field ID and date are required' });
            }
            return;
          }
          
          const availableSlots = await getAvailableTimeSlots(Number(fieldId), new Date(date));
          
          if (typeof callback === 'function') {
            callback({ success: true, data: { availableSlots } });
          }
        } catch (error) {
          console.error('Error getting available time slots:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Failed to get available time slots' });
          }
        }
      });
    });

    // Set up interval for real-time hourly updates
    if (!updateIntervalId) {
      updateIntervalId = setInterval(async () => {
        try {
          const results = await getAllFieldsAvailability();
          fieldNamespace.emit('fieldsAvailabilityUpdate', results);
          console.log('🔄 Emitted real-time field availability update');
        } catch (error) {
          console.error('Error in scheduled field availability update:', error);
        }
      }, 60 * 1000); // Check every minute
    }

    console.log('✅ Field availability namespace initialized');
    return fieldNamespace;
  } catch (error) {
    console.error('❌ Failed to initialize field namespace:', error);
    return null;
  }
};

/**
 * Get the field namespace, initializing it if necessary
 * @returns The field namespace
 */
export const getFieldNamespace = () => {
  if (!fieldNamespace) {
    try {
      fieldNamespace = initializeFieldNamespace();
    } catch (error) {
      console.error('Cannot initialize field namespace yet:', error);
    }
  }
  return fieldNamespace;
};

/**
 * Clean up resources when shutting down
 */
export const cleanupFieldNamespace = () => {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
};