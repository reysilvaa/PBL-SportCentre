import { getIO } from '../config/server/socket';
import prisma from '../config/services/database';
import { formatDateToWIB } from '../utils/variables/timezone.utils';
import { broadcastActivityLogUpdates } from './activityLog.socket';

/**
 * Emit booking-related socket events
 * 
 * @param eventType Tipe event ('new-booking', 'update-payment', 'cancel-booking', dll)
 * @param data Data yang terkait dengan event
 */
export const emitBookingEvents = (eventType: string, data: any) => {
  try {
    const io = getIO();

    switch (eventType) {
      case 'booking:created':
        handleBookingCreatedEvent(io, data);
        break;

      case 'update-payment':
        handlePaymentUpdateEvent(io, data);
        break;

      case 'booking:cancelled':
      case 'booking:deleted':
        handleBookingCanceledEvent(io, data);
        break;
        
      default:
        console.log(`Unhandled booking event type: ${eventType}`);
        // Broadcast event with raw data for custom handling
        io.emit(eventType, data);
    }
  } catch (error) {
    console.error('❌ Failed to emit Socket.IO events:', error);
    // Continue even if socket emission fails
  }
};

/**
 * Menangani event saat booking baru dibuat
 */
const handleBookingCreatedEvent = (io: any, data: any) => {
  // Emit to branch channel if booking includes field with branch
  if (data.booking?.field?.branchId) {
    io.to(`branch-${data.booking.field.branchId}`).emit(
      'booking:created',
      data.booking
    );
  }

  // Emit to user's personal channel
  if (data.booking?.userId) {
    io.to(`user-${data.booking.userId}`).emit('booking:created', {
      booking: data.booking,
      message: 'A new booking has been created for you',
    });

    // Log activity
    logBookingActivity(
      data.booking.userId,
      'CREATE_BOOKING',
      {
        bookingId: data.booking.id,
        fieldId: data.booking.fieldId,
        date: formatDateToWIB(data.booking.bookingDate),
      }
    );
  }

  // Emit to field availability channel
  if (data.booking?.fieldId) {
    io.to(`field-${data.booking.fieldId}`).emit('field:availability-changed', {
      fieldId: data.booking.fieldId,
      date: data.booking.bookingDate,
      startTime: formatDateToWIB(data.booking.startTime),
      endTime: formatDateToWIB(data.booking.endTime),
      available: false,
    });
  }
};

/**
 * Menangani event saat status pembayaran diperbarui
 */
const handlePaymentUpdateEvent = (io: any, data: any) => {
  // Emit to branch channel
  if (data.branchId) {
    io.to(`branch-${data.branchId}`).emit(
      'booking:updated',
      data.booking
    );
  }

  // Emit to user's personal channel
  if (data.userId) {
    io.to(`user-${data.userId}`).emit('booking:updated', {
      bookingId: data.booking?.id,
      paymentStatus: data.paymentStatus,
      message: `Your booking payment status has been updated to: ${data.paymentStatus}`,
    });

    // Log activity
    logBookingActivity(
      data.userId,
      'UPDATE_PAYMENT',
      {
        bookingId: data.booking?.id,
        paymentStatus: data.paymentStatus,
      }
    );
  }
};

/**
 * Menangani event saat booking dibatalkan
 */
const handleBookingCanceledEvent = (io: any, data: any) => {
  // Emit to admin channel
  io.of('/admin/bookings').emit('booking-canceled', {
    bookingId: data.bookingId,
    fieldId: data.fieldId,
    userId: data.userId,
  });

  // Update field availability
  if (data.fieldId && data.bookingDate && data.startTime && data.endTime) {
    io.of('/fields').emit('availability-update', {
      fieldId: data.fieldId,
      date: data.bookingDate,
      timeSlot: {
        start: formatDateToWIB(data.startTime),
        end: formatDateToWIB(data.endTime),
      },
      available: true,
    });
  }

  // Log activity if userId is provided
  if (data.userId) {
    logBookingActivity(
      data.userId,
      'CANCEL_BOOKING',
      {
        bookingId: data.bookingId,
        fieldId: data.fieldId,
      }
    );
  }
};

/**
 * Mencatat aktivitas booking ke activity log dan broadcast update
 */
const logBookingActivity = async (userId: number, action: string, details: any) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
      },
    });
    
    // Broadcast activity log updates
    broadcastActivityLogUpdates(userId);
  } catch (error) {
    console.error(`Failed to log booking activity: ${action}`, error);
  }
}; 