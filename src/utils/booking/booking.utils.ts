import { Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { isFieldAvailable } from './checkAvailability.utils';
import { startBookingCleanupJob } from './bookingCleanup.utils';
import { formatDateToWIB } from '../variables/timezone.utils';
import midtrans from '../../config/services/midtrans';
// Import emitBookingEvents dari socket handler yang baru dibuat
import { emitBookingEvents } from '../../socket-handlers/booking.socket';

// Initialize booking cleanup job when server starts
startBookingCleanupJob();

// Standardized error response
export const sendErrorResponse = (
  res: Response,
  status: number,
  message: any,
  details?: any
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
  endTime: Date
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
    endTime
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
  amount?: any
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
  totalPrice: number
) => {
  // Define the expiry time in Midtrans (5 minutes)
  const expiryMinutes = 5;

  // Create Midtrans transaction with expiry
  const transaction = await midtrans().createTransaction({
    transaction_details: {
      order_id: `PAY-${payment.id}-${Date.now()}`,
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

  // Update the payment record with the expiry date, payment URL, and transaction ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: { 
      expiresDate: expiryDate,
      paymentUrl: transaction.redirect_url,
      transactionId: transaction.transaction_id
    },
  });

  return { transaction, expiryDate };
};

// Export emitBookingEvents dari socket handler
export { emitBookingEvents };

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
