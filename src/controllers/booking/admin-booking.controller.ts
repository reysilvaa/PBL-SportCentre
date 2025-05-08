import { Response } from 'express';
import prisma from '../../config/services/database';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  emitBookingEvents,
  getCompleteBooking,
  verifyFieldBranch,
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice, combineDateWithTime } from '../../utils/booking/calculateBooking.utils';
import { invalidateBookingCache } from '../../utils/cache/cacheInvalidation.utils';
import { User } from '../../middlewares/auth.middleware';

/**
 * Branch Admin Booking Controller
 * Berisi semua operasi booking yang dapat dilakukan oleh admin cabang
 */

export const getBranchBookings = async (req: User, res: Response): Promise<void> => {
  try {
    // Dari middleware auth kita sudah punya branchId di req.userBranch
    const branchId = req.userBranch?.id;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat melihat booking dari branch tertentu
    const whereCondition =
      branchId === 0 && req.query.branchId
        ? { field: { branchId: parseInt(req.query.branchId as string) } }
        : { field: { branchId } };

    // Get all bookings for fields in this branch
    const bookings = await prisma.booking.findMany({
      where: whereCondition,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error getting branch bookings:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBranchBookingById = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat melihat booking dari branch tertentu
    const whereCondition = branchId === 0 ? { id: bookingId } : { id: bookingId, field: { branchId } };

    const booking = await prisma.booking.findFirst({
      where: whereCondition,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error('Error getting branch booking by ID:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const updateBranchBookingStatus = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;
    const { paymentStatus } = req.body;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat mengupdate booking dari branch tertentu
    const whereCondition = branchId === 0 ? { id: bookingId } : { id: bookingId, field: { branchId } };

    // Verify the booking belongs to this branch
    const booking = await prisma.booking.findFirst({
      where: whereCondition,
      include: {
        payment: true,
        user: { select: { id: true } },
        field: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    // Update payment status
    if (booking.payment && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: paymentStatus },
      });
    }

    // Return updated booking
    const updatedBooking = await getCompleteBooking(bookingId);

    // Emit WebSocket event for booking update
    emitBookingEvents('update-payment', {
      booking: updatedBooking,
      userId: booking.user?.id,
      branchId,
      paymentStatus,
    });

    // Hapus cache yang terkait booking
    await invalidateBookingCache(bookingId, booking.fieldId, booking.field.branchId, booking.userId);

    res.status(200).json({
      status: true,
      message: 'Status booking berhasil diperbarui',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Error updating branch booking status:', error);
    sendErrorResponse(res, 400, 'Failed to update booking');
  }
};

export const createManualBooking = async (req: User, res: Response): Promise<void> => {
  try {
    const branchId = req.userBranch?.id;
    const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus } = req.body;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat membuat booking untuk branch tertentu
    const whereBranchCondition = branchId === 0 && req.body.branchId ? parseInt(req.body.branchId) : branchId;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(parseInt(fieldId), whereBranchCondition);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found in this branch');
    }

    const bookingDateTime = new Date(bookingDate);
    console.log('📆 Booking Date:', bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(parseInt(fieldId), bookingDateTime, startDateTime, endDateTime);

    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Calculate price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight),
    );

    // Create booking and payment records
    const { booking, payment } = await createBookingWithPayment(
      parseInt(userId),
      parseInt(fieldId),
      bookingDateTime,
      startDateTime,
      endDateTime,
      paymentStatus || 'paid',
      'cash',
      totalPrice,
    );

    // Emit real-time events
    emitBookingEvents('booking:created', { booking, payment });

    // Invalidate cache
    await invalidateBookingCache(booking.id, parseInt(fieldId), whereBranchCondition, parseInt(userId));

    res.status(201).json({
      status: true,
      message: 'Booking manual berhasil dibuat',
      data: {
        booking,
        payment,
      },
    });
  } catch (error) {
    console.error('Error creating manual booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};
