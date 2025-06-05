import { Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus, PaymentMethod, User, Booking, Payment, Field } from '../../types';
import { isFieldAvailable } from './checkAvailability.utils';
import { bookingCleanupQueue } from '../../config/services/queue';
import { formatDateToWIB } from '../variables/timezone.utils';
import { midtrans } from '../../config/services/midtrans';
import { emitBookingEvents } from '../../socket-handlers/booking.socket';

/**
 * Standardized error response
 */
export const sendErrorResponse = (
  res: Response,
  status: number,
  message: any,
  details?: any
): void => {
  res.status(status).json({ error: message, ...(details && { details }) });
};

/**
 * Verify field belongs to branch
 */
export const verifyFieldBranch = async (
  fieldId: number,
  branchId: number
): Promise<Field | null> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      branchId: branchId,
    },
  });

  return field as Field | null;
};

/**
 * Check booking time validity and availability
 * Fungsi menggunakan waktu dalam timezone WIB untuk pengecekan
 */
export const validateBookingTime = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<{ valid: boolean; message?: string; details?: any }> => {
  // Validate start and end times
  if (startTime >= endTime) {
    return {
      valid: false,
      message: 'Waktu selesai harus setelah waktu mulai',
      details: {
        startTime: formatDateToWIB(startTime),
        endTime: formatDateToWIB(endTime),
      },
    };
  }

  // Log untuk debugging
  console.log('Validating booking time:');
  console.log(`Field ID: ${fieldId}`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`End Time: ${endTime.toISOString()}`);

  // Check field availability
  const isAvailable = await isFieldAvailable(fieldId, bookingDate, startTime, endTime);

  if (!isAvailable) {
    return {
      valid: false,
      message: 'Lapangan sudah dibooking untuk waktu yang dipilih',
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

/**
 * Create booking and payment records
 * PENTING: Semua parameter waktu harus dalam format UTC untuk konsistensi di database
 */
export const createBookingWithPayment = async (
  userId: number,
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date,
  paymentStatus: PaymentStatus = PaymentStatus.PENDING,
  paymentMethod: PaymentMethod = PaymentMethod.CASH,
  amount?: any
): Promise<{ booking: Booking; payment: Payment }> => {
  // Log nilai waktu untuk debugging
  console.log('Creating booking with UTC times:');
  console.log(`Booking Date: ${bookingDate.toISOString()}`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`End Time: ${endTime.toISOString()}`);

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

  return { booking: booking as Booking, payment: payment as Payment };
};

/**
 * Process Midtrans payment for booking
 */
export const processMidtransPayment = async (
  booking: Booking,
  payment: Payment,
  field: Field,
  user: User,
  totalPrice: number
): Promise<{ transaction: any; expiryDate: Date }> => {
  // Define the expiry time in Midtrans (5 minutes)
  const expiryMinutes = 5;

  // Create Midtrans transaction with expiry
  const midtransClient = midtrans();
  const transaction = await midtransClient.createTransaction({
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
        // Buat nama item lebih pendek untuk mencegah error "Name too long"
        name: `Booking ${field.name}`, 
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
      transactionId: transaction.transaction_id,
    },
  });

  return { transaction, expiryDate };
};

/**
 * Function to mark expired pending bookings as failed
 * Bookings that haven't been paid within 5 minutes after Midtrans confirmation will be marked as failed
 */
export const cleanupPendingBookings = async (): Promise<void> => {
  try {
    // Find payments with 'pending' status that have passed their expiration date
    const currentTime = new Date();

    console.log('🧹 Processing expired pending bookings at:', currentTime);

    // Find expired pending payments
    // Only process ones that have an expiresDate set (meaning they've received Midtrans notification)
    const expiredPayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiresDate: {
          not: null, // Only process payments that have an expiry date set
          lt: currentTime, // Only process expired payments
        },
      },
      include: {
        booking: {
          include: {
            field: true,
            user: true,
          },
        },
      },
    });

    console.log(`🔍 Found ${expiredPayments.length} expired pending payments`);

    // Update the payment status to 'failed' instead of deleting
    for (const payment of expiredPayments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      console.log(
        `🔄 Updated payment #${payment.id} status to 'failed' for booking #${payment.booking?.id}`
      );

      // Emit event for booking cancellation to update field availability
      if (payment.booking) {
        const booking = payment.booking;

        // Emit event to notify system that booking is canceled
        emitBookingEvents('cancel-booking', {
          bookingId: booking.id,
          fieldId: booking.fieldId,
          userId: booking.userId,
          branchId: booking.field?.branchId,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        });

        // Emit notification to user
        emitBookingEvents('booking:updated', {
          booking: booking,
          userId: booking.userId,
          branchId: booking.field?.branchId,
          paymentStatus: 'failed',
        });

        console.log(
          `🔔 Notified system about canceled booking #${booking.id} due to payment expiry`
        );
      }
    }

    console.log('✅ Expired booking processing completed');
  } catch (error) {
    console.error('❌ Error in cleanupPendingBookings:', error);
  }
};

/**
 * Setup processor for booking cleanup job
 */
export const setupBookingCleanupProcessor = (): void => {
  // Proses job
  bookingCleanupQueue.process(async () => {
    console.log('⏰ Running automatic expired booking processing');
    await cleanupPendingBookings();
    return { success: true, timestamp: new Date() };
  });

  console.log('✅ Booking cleanup processor didaftarkan');
};

/**
 * Start booking cleanup job that runs every 1 minute
 */
export const startBookingCleanupJob = (): void => {
  // Menjalankan proses cleanup segera
  bookingCleanupQueue.add({}, { jobId: 'initial-cleanup' });

  // Tambahkan recurring job (setiap 1 menit)
  bookingCleanupQueue.add(
    {},
    {
      jobId: 'cleanup-recurring',
      repeat: { cron: '*/1 * * * *' }, // Sama dengan cron: setiap 1 menit
    }
  );

  console.log('🚀 Expired booking cleanup Bull Queue job started');
};

/**
 * Stop the booking cleanup job
 */
export const stopBookingCleanupJob = async (): Promise<void> => {
  await bookingCleanupQueue.close();
  console.log('🛑 Expired booking cleanup Bull Queue job stopped');
};

/**
 * Get complete booking with relations
 */
export const getCompleteBooking = async (bookingId: number): Promise<Booking | null> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      field: { include: { branch: true } },
      payment: true,
    },
  });

  return booking as Booking | null;
};

// Export emitBookingEvents for use elsewhere
export { emitBookingEvents };
