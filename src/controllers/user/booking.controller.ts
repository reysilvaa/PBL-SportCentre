import { Request, Response } from 'express';
import prisma from '../../config/database';
import { createBookingSchema } from '../../zod-schemas/booking.schema';
import { 
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  processMidtransPayment,
  emitBookingEvents,
  getCompleteBooking
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice } from '../../utils/booking/calculateBooking.utils';
import { PaymentStatus } from '@prisma/client';
import { 
  parseISO, 
  addMinutes
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { 
  TIMEZONE, 
  formatDateToWIB, 
  combineDateWithTimeWIB 
} from '../../utils/variables/timezone.utils';
import { deleteCachedDataByPattern } from '../../utils/cache.utils';
import { trackFailedBooking, resetFailedBookingCounter } from '../../middlewares/security.middleware';

// Define interface for Request with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

/**
 * User Booking Controller
 * Handles operations that regular users can perform
 */

export const createBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    console.log("📥 Request body:", req.body);

    // Validasi data dengan Zod
    const result = createBookingSchema.safeParse(req.body);
    
    if (!result.success) {
      return sendErrorResponse(res, 400, 'Validasi gagal', 
        result.error.format()
      );
    }

    const { userId, fieldId, bookingDate, startTime, endTime } = result.data;

    // Convert strings to Date objects
    const bookingDateTime = parseISO(bookingDate);
    console.log("📆 Booking Date (WIB):", formatDateToWIB(bookingDateTime));

    // Combine date with time in WIB timezone
    const startDateTime = toZonedTime(
      combineDateWithTimeWIB(bookingDateTime, startTime),
      TIMEZONE
    );
    
    const endDateTime = toZonedTime(
      combineDateWithTimeWIB(bookingDateTime, endTime),
      TIMEZONE
    );
    
    console.log("⏰ Start Time (WIB):", formatDateToWIB(startDateTime));
    console.log("⏰ End Time (WIB):", formatDateToWIB(endDateTime));

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime
    );
    
    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Get field details for pricing
    const field = await prisma.field.findUnique({ 
      where: { id: fieldId }, 
      include: { branch: true } 
    });

    console.log("📜 Field details:", field);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found');
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true }
    });
    
    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(startDateTime, endDateTime, Number(field.priceDay), Number(field.priceNight));
    
    if (totalPrice <= 0) {
      return sendErrorResponse(res, 400, 'Invalid price calculation');
    }
    
    console.log("💵 Total price:", totalPrice);

    // Create booking with pending payment by default
    const { booking, payment } = await createBookingWithPayment(
      userId,
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime,
      'pending',
      'midtrans',
      totalPrice
    );
    
    console.log("✅ Booking created:", booking.id);
    console.log("💳 Payment created:", payment.id);

    // Process payment via Midtrans API
    const paymentResult = await processMidtransPayment(
      booking,
      payment,
      field,
      user,
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
        status: 'pending'
      }
    });

    console.log("💳 Payment updated with transaction details");

    // Emit real-time events via Socket.IO
    emitBookingEvents('booking:created', { booking, payment });

    // Clear any cached data that might be affected by this new booking
    await deleteCachedDataByPattern(`field:${fieldId}:availability:*`);
    
    // Return response with booking and payment details
    res.status(201).json({
      booking: {
        ...booking,
        field,
        payment: {
          ...payment,
          paymentUrl: paymentResult.transaction.redirect_url,
          status: 'pending'
        }
      }
    });
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    
    // Jika error, lacak sebagai percobaan gagal
    if (req.user?.id) {
      const clientIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      await trackFailedBooking(req.user.id, 0, clientIP);
    }
    
    sendErrorResponse(res, 500, 'Failed to create booking');
  }
};

// Additional function for webhook handler to update payment expiry
export const midtransWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = req.body;
    
    console.log("📩 Midtrans notification:", notification);
    
    // Extract order ID from Midtrans notification
    const orderId = notification.order_id;
    
    // Extract payment ID from order ID (assuming format PAY-{id})
    const paymentId = parseInt(orderId.split('-')[1]);
    
    if (!paymentId) {
      return sendErrorResponse(res, 400, 'Invalid order ID format');
    }
    
    // Get the payment record
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            field: true,
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });
    
    if (!payment) {
      return sendErrorResponse(res, 404, 'Payment not found');
    }
    
    // Update payment status based on notification
    const transactionStatus = notification.transaction_status;
    let newPaymentStatus: PaymentStatus = 'pending' as PaymentStatus;
    
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      newPaymentStatus = 'paid' as PaymentStatus;
    } else if (transactionStatus === 'pending') {
      // Payment is still pending, but we need to update the expiry
      // Start the 5-minute countdown now (in WIB)
      const now = new Date();
      const expiryDate = addMinutes(now, 5);
      
      await prisma.payment.update({
        where: { id: paymentId },
        data: { 
          status: 'pending' as PaymentStatus,
          expiresDate: expiryDate
        }
      });
      
      console.log(`⏱️ Updated payment #${paymentId} expiry to ${formatDateToWIB(expiryDate)} after Midtrans notification`);
      
      // Emit socket event for payment update
      emitBookingEvents('update-payment', {
        booking: payment.booking,
        userId: payment.userId,
        branchId: payment.booking.field.branchId,
        paymentStatus: 'pending'
      });
      
      res.status(200).json({ status: 'ok' });
      return;
    } else if (['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus)) {
      newPaymentStatus = 'failed' as PaymentStatus;
    }
    
    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: newPaymentStatus }
    });
    
    console.log(`💳 Updated payment #${paymentId} status to ${newPaymentStatus}`);
    
    // Emit socket event for payment status change
    emitBookingEvents('update-payment', {
      booking: payment.booking,
      userId: payment.userId,
      branchId: payment.booking.field.branchId,
      paymentStatus: newPaymentStatus
    });
    
    // If payment failed, update field availability
    if (newPaymentStatus === 'failed') {
      const booking = payment.booking;
      emitBookingEvents('cancel-booking', {
        bookingId: booking.id,
        fieldId: booking.fieldId,
        userId: booking.userId,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime
      });
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error("❌ Error in midtransWebhook:", error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const bookings = await prisma.booking.findMany({
      where: { userId: parseInt(userId) },
      include: {
        field: { include: { branch: true } },
        payment: true
      },
      orderBy: { bookingDate: 'desc' }
    });
    
    // Format dates for display (optional)
    const formattedBookings = bookings.map(booking => ({
      ...booking,
      _formattedBookingDate: formatDateToWIB(booking.bookingDate),
      _formattedStartTime: formatDateToWIB(booking.startTime),
      _formattedEndTime: formatDateToWIB(booking.endTime),
      payment: booking.payment ? {
        ...booking.payment,
        _formattedExpiresDate: booking.payment.expiresDate ? 
          formatDateToWIB(booking.payment.expiresDate) : null
      } : null
    }));
    
    res.json(formattedBookings);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBookingById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    
    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'Invalid booking ID');
    }
    
    // Get the complete booking with all relations
    const booking = await getCompleteBooking(bookingId);
    
    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found');
    }
    
    // Check if the user has permission to view this booking
    // Regular users can only see their own bookings
    if (req.user?.role !== 'admin' && req.user?.id !== booking.userId) {
      return sendErrorResponse(res, 403, 'You do not have permission to view this booking');
    }
    
    // Format dates for display (optional)
    const formattedBooking = {
      ...booking,
      _formattedBookingDate: formatDateToWIB(booking.bookingDate),
      _formattedStartTime: formatDateToWIB(booking.startTime),
      _formattedEndTime: formatDateToWIB(booking.endTime),
      payment: booking.payment ? {
        ...booking.payment,
        _formattedExpiresDate: booking.payment.expiresDate ? 
          formatDateToWIB(booking.payment.expiresDate) : null
      } : null
    };
    
    res.json(formattedBooking);
  } catch (error) {
    console.error("❌ Error in getBookingById:", error);
    sendErrorResponse(res, 500, 'Failed to retrieve booking details');
  }
};

// Menangkap pembatalan booking yang sering
export const cancelBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    
    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'Invalid booking ID');
    }
    
    // Get the complete booking with all relations
    const booking = await getCompleteBooking(bookingId);
    
    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found');
    }
    
    // Periksa apakah pengguna memiliki izin untuk membatalkan booking ini
    if (req.user?.role !== 'admin' && req.user?.id !== booking.userId) {
      return sendErrorResponse(res, 403, 'Anda tidak memiliki izin untuk membatalkan booking ini');
    }
    
    // Periksa status pembayaran
    if (booking.payment?.status === 'paid') {
      return sendErrorResponse(res, 400, 'Booking dengan status pembayaran PAID tidak dapat dibatalkan');
    }
    
    // Jika status pending, perbarui menjadi canceled/failed
    if (booking.payment) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: 'failed' }
      });
    }
    
    // Tambahkan ke statistik pembatalan user
    if (req.user?.id) {
      const clientIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
      // Melacak pembatalan sebagai potensi penyalahgunaan
      await trackFailedBooking(req.user.id, bookingId, clientIP);
    }
    
    // Emit real-time events via Socket.IO
    emitBookingEvents('booking:canceled', { booking });
    
    // Clear any cached data that might be affected
    await deleteCachedDataByPattern(`field:${booking.fieldId}:availability:*`);
    
    res.json({ message: 'Booking telah dibatalkan' });
  } catch (error) {
    console.error("❌ Error canceling booking:", error);
    sendErrorResponse(res, 500, 'Gagal membatalkan booking');
  }
};