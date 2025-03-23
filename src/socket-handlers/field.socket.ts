import { Socket } from 'socket.io';
import { getIO, applyAuthMiddleware, setupNamespaceEvents } from '../config/';
import {
  isFieldAvailable,
  getAllFieldsAvailability,
  getAvailableTimeSlots,
} from '../utils/booking/checkAvailability.utils';

/**
 * Handle checking all fields availability
 */
export const handleCheckAllFieldsAvailability = async (
  socket: Socket,
  data: any,
  callback?: Function,
) => {
  try {
    const results = await getAllFieldsAvailability();

    // Send response through callback if provided
    if (typeof callback === 'function') {
      callback({ success: true, data: results });
    }

    // Also broadcast to all connected clients
    const io = getIO();
    io.of('/fields').emit('fieldsAvailabilityUpdate', results);
  } catch (error) {
    console.error('Error checking all fields availability:', error);
    if (typeof callback === 'function') {
      callback({
        success: false,
        error: 'Failed to check all fields availability',
      });
    }
  }
};

/**
 * Handle checking field availability
 */
export const handleCheckFieldAvailability = async (
  socket: Socket,
  data: any,
  callback?: Function,
) => {
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
      end,
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
};

/**
 * Handle getting available time slots
 */
export const handleGetAvailableTimeSlots = async (
  socket: Socket,
  data: any,
  callback?: Function,
) => {
  try {
    const { fieldId, date } = data;

    if (!fieldId || !date) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Field ID and date are required' });
      }
      return;
    }

    const availableSlots = await getAvailableTimeSlots(
      Number(fieldId),
      new Date(date),
    );

    if (typeof callback === 'function') {
      callback({ success: true, data: { availableSlots } });
    }
  } catch (error) {
    console.error('Error getting available time slots:', error);
    if (typeof callback === 'function') {
      callback({ success: false, error: 'Failed to get available time slots' });
    }
  }
};

/**
 * Setup WebSocket handlers for field availability
 */
export const setupFieldSocketHandlers = (): void => {
  const io = getIO();
  const fieldNamespace = io.of('/fields');

  // Apply authentication middleware (optional)
  applyAuthMiddleware(fieldNamespace, false);

  // Set up basic namespace events
  setupNamespaceEvents(fieldNamespace);

  // Set up connection handler for the field namespace
  fieldNamespace.on('connection', (socket: Socket) => {
    console.log(`🏟️ Client connected to fields namespace: ${socket.id}`);

    // Handle requests for all fields availability
    socket.on('checkAllFieldsAvailability', (data, callback) =>
      handleCheckAllFieldsAvailability(socket, data, callback),
    );

    // Handle requests for specific field availability
    socket.on('checkFieldAvailability', (data, callback) =>
      handleCheckFieldAvailability(socket, data, callback),
    );

    // Handle requests for available time slots
    socket.on('getAvailableTimeSlots', (data, callback) =>
      handleGetAvailableTimeSlots(socket, data, callback),
    );

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🏟️ Client disconnected from fields namespace: ${socket.id}`);
    });
  });

  console.log('✅ Field socket handlers initialized');
};
