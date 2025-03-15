import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import prisma from '../../config/database';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
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

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("📥 Request body:", req.body);

    // Transform request body to DTO object
    const bookingDto = plainToClass(CreateBookingDto, req.body);
    
    // Validate DTO
    const validationErrors = await validate(bookingDto);
    if (validationErrors.length > 0) {
      return sendErrorResponse(res, 400, 'Validation failed', 
        validationErrors.map(err => ({
          property: err.property,
          constraints: err.constraints
        }))
      );
    }

    const { userId, fieldId, bookingDate, startTime, endTime } = bookingDto;

    // Convert userId and fieldId to integers
    const userIdInt = parseInt(userId.toString());
    const fieldIdInt = parseInt(fieldId.toString());

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
      fieldIdInt,
      bookingDateTime,
      startDateTime,
      endDateTime
    );
    
    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Get field details for pricing
    const field = await prisma.field.findUnique({ 
      where: { id: fieldIdInt }, 
      include: { branch: true } 
    });

    console.log("📜 Field details:", field);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found');
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userIdInt },
      select: { name: true, email: true, phone: true }
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    // Calculate price based on booking time
    console.log("💰 Field price (Day/Night):", field.priceDay, field.priceNight);
    const totalPrice = calculateTotalPrice(
      startDateTime, 
      endDateTime, 
      Number(field.priceDay), 
      Number(field.priceNight)
    );
    console.log("💵 Total price:", totalPrice);

    // Create booking and payment records
    const { booking: newBooking, payment } = await createBookingWithPayment(
      userIdInt,
      fieldIdInt,
      bookingDateTime,
      startDateTime,
      endDateTime,
      'pending',
      'midtrans',
      totalPrice
    );

    console.log("✅ Booking created:", newBooking);
    console.log("💳 Payment created:", payment);

    // Process payment with Midtrans
    const { transaction, expiryDate } = await processMidtransPayment(
      newBooking, 
      payment, 
      field, 
      user, 
      totalPrice
    );

    console.log("🔗 Midtrans transaction:", transaction);
    console.log("⏱️ Payment expires at (WIB):", formatDateToWIB(expiryDate));

    // Emit event via Socket.IO to notify about new booking
    try {
      emitBookingEvents('new-booking', {
        booking: await getCompleteBooking(newBooking.id),
        userId: userIdInt,
        fieldId: fieldIdInt,
        branchId: field.branchId,
        bookingDate: bookingDateTime,
        startTime: startDateTime,
        endTime: endDateTime
      });
    } catch (error) {
      console.error("❌ Failed to emit Socket.IO events:", error);
      // Continue even if socket emission fails
    }

    // Return data with redirect URL
    res.status(201).json({ 
      booking: newBooking, 
      payment, 
      redirect_url: transaction.redirect_url 
    });
  } catch (error) {
    console.error("❌ Error in createBooking:", error);
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