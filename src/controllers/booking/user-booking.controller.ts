import { Response } from 'express';
import prisma from '../../config/services/database';
import { createBookingSchema } from '../../zod-schemas/booking.schema';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  processMidtransPayment,
  emitBookingEvents,
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice } from '../../utils/booking/calculateBooking.utils';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TIMEZONE, formatDateToWIB, combineDateWithTimeWIB } from '../../utils/variables/timezone.utils';
import { invalidateBookingCache } from '../../utils/cache/cacheInvalidation.utils';
import { trackFailedBooking, resetFailedBookingCounter } from '../../middlewares/security.middleware';
import { User } from '../../middlewares/auth.middleware';
import { PaymentMethod, PaymentStatus } from '../../types';

/**
 * User Booking Controller
 * Berisi semua operasi booking untuk pengguna biasa
 */

export const createBooking = async (req: User, res: Response): Promise<void> => {
  try {
    console.log('📥 Request body:', req.body);

    // Validasi data dengan Zod
    const result = createBookingSchema.safeParse(req.body);

    if (!result.success) {
      return sendErrorResponse(res, 400, 'Validasi gagal', result.error.format());
    }

    const { userId, fieldId, bookingDate, startTime, endTime } = result.data;

    // Convert strings to Date objects
    const bookingDateTime = parseISO(bookingDate);
    console.log('🗓️ Booking Date (WIB):', formatDateToWIB(bookingDateTime));

    // Combine date with time in WIB timezone
    // PENTING: startTime bersifat inclusive, endTime bersifat exclusive
    // Contoh: booking 08:00-10:00 berarti dari jam 08:00 sampai 09:59:59
    const startDateTimeWIB = toZonedTime(combineDateWithTimeWIB(bookingDateTime, startTime), TIMEZONE);
    const endDateTimeWIB = toZonedTime(combineDateWithTimeWIB(bookingDateTime, endTime), TIMEZONE);

    // Konversi ke UTC untuk penyimpanan di database
    const startDateTime = new Date(startDateTimeWIB.toISOString());
    const endDateTime = new Date(endDateTimeWIB.toISOString());

    console.log('⏰ Start Time (WIB):', formatDateToWIB(startDateTimeWIB));
    console.log('⏰ End Time (WIB) (exclusive):', formatDateToWIB(endDateTimeWIB));
    console.log('⏰ Start Time (UTC):', startDateTime.toISOString());
    console.log('⏰ End Time (UTC):', endDateTime.toISOString());
    console.log('⏰ Durasi booking:', Math.floor((endDateTimeWIB.getTime() - startDateTimeWIB.getTime()) / (1000 * 60 * 60)), 'jam');

    // Validate booking time and availability (tetap gunakan waktu WIB untuk validasi)
    const timeValidation = await validateBookingTime(fieldId, bookingDateTime, startDateTimeWIB, endDateTimeWIB);

    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Get field details for pricing
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: { branch: true },
    });

    console.log('📜 Field details:', field);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found');
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );

    if (totalPrice <= 0) {
      return sendErrorResponse(res, 400, 'Invalid price calculation');
    }

    console.log('💵 Total price:', totalPrice);

    // Create booking with pending payment by default
    const { booking, payment } = await createBookingWithPayment(
      userId,
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime,
      PaymentStatus.PENDING,
      PaymentMethod.MIDTRANS,
      totalPrice
    );

    console.log('✅ Booking created:', booking.id);
    console.log('💳 Payment created:', payment.id);

    // Process payment via Midtrans API
    const paymentResult = await processMidtransPayment(
      booking,
      payment,
      field as any, // Type casting untuk mengatasi masalah tipe
      user as any, // Type casting untuk mengatasi masalah tipe
      totalPrice
    );

    if (!paymentResult) {
      // Jika gagal membuat pembayaran, lacak sebagai percobaan gagal
      if (req.user?.id) {
        const clientIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
        await trackFailedBooking(req.user.id, booking.id, clientIP);
      }

      return sendErrorResponse(res, 500, 'Failed to create payment gateway');
    }

    // Reset counter jika booking berhasil dibuat (status pending tetap dianggap berhasil)
    if (req.user?.id) {
      resetFailedBookingCounter(req.user.id);
    }

    // Update payment record with Midtrans transaction details
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        expiresDate: paymentResult.expiryDate,
        status: PaymentStatus.PENDING,
        transactionId: paymentResult.transaction.transaction_id,
        paymentUrl: paymentResult.transaction.redirect_url,
      },
    });

    console.log('💳 Payment updated with transaction details');

    // Emit real-time events via Socket.IO
    emitBookingEvents('booking:created', { booking, payment });

    // Clear any cached data that might be affected by this new booking
    await invalidateBookingCache(booking.id, fieldId, field.branchId, userId);

    // Return response with booking and payment details
    res.status(201).json({
      booking: {
        ...booking,
        field,
        payment: {
          ...payment,
          paymentUrl: paymentResult.transaction.redirect_url,
          status: PaymentStatus.PENDING,
        },
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error', error);
  }
};

export const getUserBookings = async (req: User, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const parsedUserId = parseInt(userId);

    if (isNaN(parsedUserId)) {
      return sendErrorResponse(res, 400, 'Invalid user ID');
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: parsedUserId },
      include: {
        field: {
          include: {
            branch: {
              select: { id: true, name: true, location: true, imageUrl: true },
            },
            type: true,
          },
        },
        payment: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error getting user bookings:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBookingById = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'Invalid booking ID');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: {
          include: {
            branch: {
              select: { id: true, name: true, location: true, imageUrl: true },
            },
            type: true,
          },
        },
        payment: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found');
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error('Error getting booking by ID:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const cancelBooking = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'Invalid booking ID');
    }

    // Get current booking with payment info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        field: { select: { id: true, branchId: true } },
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found');
    }

    // Only allow cancellation of pending and unpaid bookings
    if (booking.payment?.status === PaymentStatus.PAID) {
      return sendErrorResponse(res, 400, 'Cannot cancel a booking that has been paid. Please contact administrator.');
    }

    // Delete payment first (foreign key constraint)
    if (booking.payment) {
      await prisma.payment.delete({
        where: { id: booking.payment.id },
      });
    }

    // Then delete booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    // Invalidate cache
    await invalidateBookingCache(bookingId, booking.field.id, booking.field.branchId, booking.userId);

    // Emit booking cancelled event
    emitBookingEvents('booking:cancelled', { bookingId });

    res.status(200).json({
      status: true,
      message: 'Booking berhasil dibatalkan',
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};
