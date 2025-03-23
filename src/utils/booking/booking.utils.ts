import { Response } from 'express';
import prisma from '../../config/services/database';
import { getIO } from '../../config/server/socket';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { isFieldAvailable } from './checkAvailability.utils';
import { startBookingCleanupJob } from './bookingCleanup.utils';
import { formatDateToWIB } from '../variables/timezone.utils';
import { broadcastActivityLogUpdates } from '../../socket-handlers/activityLog.socket';
import midtrans from '../../config/services/midtrans';

// Initialize booking cleanup job when server starts
startBookingCleanupJob();

// Standardized error response
export const sendErrorResponse = (
  res: Response,
  status: number,
  message: any,
  details?: any,
): void => {
  res.status(status).json({ error: message, ...(details && { details }) });
};

// Verify field belongs to branch
export const verifyFieldBranch = async (fieldId: number, branchId: number) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      branchId: branchId,
    },
  });

  return field;
};

// Check booking time validity and availability
export const validateBookingTime = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date,
) => {
  // Validate start and end times
  if (startTime >= endTime) {
    return {
      valid: false,
      message: 'End time must be after start time',
      details: {
        startTime: formatDateToWIB(startTime),
        endTime: formatDateToWIB(endTime),
      },
    };
  }

  // Check field availability
  const isAvailable = await isFieldAvailable(
    fieldId,
    bookingDate,
    startTime,
    endTime,
  );

  if (!isAvailable) {
    return {
      valid: false,
      message: 'Field is already booked for the selected time slot',
      details: {
        fieldId,
        date: formatDateToWIB(bookingDate),
        startTime: formatDateToWIB(startTime),
        endTime: formatDateToWIB(endTime),
      },
    };
  }

  return { valid: true };
};

// Create booking and payment records
export const createBookingWithPayment = async (
  userId: number,
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date,
  paymentStatus: PaymentStatus = 'pending',
  paymentMethod: PaymentMethod = 'cash',
  amount?: any,
) => {
  // Create booking record
  const booking = await prisma.booking.create({
    data: {
      userId,
      fieldId,
      bookingDate,
      startTime,
      endTime,
    },
  });

  // Get field for pricing if amount not provided
  let paymentAmount = amount;
  if (!paymentAmount) {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (field) {
      paymentAmount = field.priceDay; // Default to day price
    } else {
      paymentAmount = 0; // Fallback
    }
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId,
      amount: paymentAmount,
      status: paymentStatus,
      paymentMethod,
    },
  });

  return { booking, payment };
};

// Process Midtrans payment for booking
export const processMidtransPayment = async (
  booking: any,
  payment: any,
  field: any,
  user: any,
  totalPrice: number,
) => {
  // Define the expiry time in Midtrans (5 minutes)
  const expiryMinutes = 5;

  // Create Midtrans transaction with expiry
  const transaction = await midtrans().createTransaction({
    transaction_details: {
      order_id: `PAY-${payment.id}`,
      gross_amount: totalPrice,
    },
    customer_details: {
      first_name: user.name || 'Customer',
      email: user.email || 'customer@example.com',
      phone: user.phone || '08123456789',
    },
    item_details: [
      {
        id: field.id.toString(),
        name: `${field.branch?.name || 'Field'} - ${field.name}`,
        price: totalPrice,
        quantity: 1,
      },
    ],
    expiry: {
      unit: 'minutes',
      duration: expiryMinutes,
    },
  });

  // Extract expiry time from Midtrans response and update payment record
  let expiryDate: Date;

  if (transaction.expiry_time) {
    expiryDate = new Date(transaction.expiry_time);
  } else {
    expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
  }

  // Update the payment record with the expiry date
  await prisma.payment.update({
    where: { id: payment.id },
    data: { expiresDate: expiryDate },
  });

  return { transaction, expiryDate };
};

// Emit booking-related socket events
export const emitBookingEvents = (eventType: string, data: any) => {
  try {
    const io = getIO();

    switch (eventType) {
      case 'new-booking':
        // Emit to branch channel
        if (data.branchId) {
          io.to(`branch-${data.branchId}`).emit(
            'booking:created',
            data.booking,
          );
        }

        // Emit to user's personal channel
        if (data.userId) {
          io.to(`user-${data.userId}`).emit('booking:created', {
            booking: data.booking,
            message: 'A new booking has been created for you',
          });

          // Log activity
          prisma.activityLog
            .create({
              data: {
                userId: data.userId,
                action: 'CREATE_BOOKING',
                details: JSON.stringify({
                  bookingId: data.booking.id,
                  fieldId: data.fieldId,
                  date: formatDateToWIB(data.bookingDate),
                }),
              },
            })
            .then(() => {
              // Broadcast activity log updates
              broadcastActivityLogUpdates(data.userId);
            });
        }

        // Emit to field availability channel
        if (data.fieldId) {
          io.to(`field-${data.fieldId}`).emit('field:availability-changed', {
            fieldId: data.fieldId,
            date: data.bookingDate,
            startTime: formatDateToWIB(data.startTime),
            endTime: formatDateToWIB(data.endTime),
            available: false,
          });
        }
        break;

      case 'update-payment':
        // Emit to branch channel
        if (data.branchId) {
          io.to(`branch-${data.branchId}`).emit(
            'booking:updated',
            data.booking,
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
          prisma.activityLog
            .create({
              data: {
                userId: data.userId,
                action: 'UPDATE_PAYMENT',
                details: JSON.stringify({
                  bookingId: data.booking?.id,
                  paymentStatus: data.paymentStatus,
                }),
              },
            })
            .then(() => {
              // Broadcast activity log updates
              broadcastActivityLogUpdates(data.userId);
            });
        }
        break;

      case 'cancel-booking':
        // Emit to admin channel
        io.of('/admin/bookings').emit('booking-canceled', {
          bookingId: data.bookingId,
          fieldId: data.fieldId,
          userId: data.userId,
        });

        // Update field availability
        io.of('/fields').emit('availability-update', {
          fieldId: data.fieldId,
          date: data.bookingDate,
          timeSlot: {
            start: formatDateToWIB(data.startTime),
            end: formatDateToWIB(data.endTime),
          },
          available: true,
        });

        // Log activity if userId is provided
        if (data.userId) {
          prisma.activityLog
            .create({
              data: {
                userId: data.userId,
                action: 'CANCEL_BOOKING',
                details: JSON.stringify({
                  bookingId: data.bookingId,
                  fieldId: data.fieldId,
                }),
              },
            })
            .then(() => {
              // Broadcast activity log updates
              broadcastActivityLogUpdates(data.userId);
            });
        }
        break;
    }
  } catch (error) {
    console.error('❌ Failed to emit Socket.IO events:', error);
    // Continue even if socket emission fails
  }
};

// Get complete booking with relations
export const getCompleteBooking = async (bookingId: number) => {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      field: { include: { branch: true } },
      payment: true,
    },
  });
};
