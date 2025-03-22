import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { getIO } from '../../../config/socket';
import {
  sendErrorResponse,
  verifyFieldBranch,
  validateBookingTime,
  createBookingWithPayment,
  getCompleteBooking,
  emitBookingEvents,
} from '../../../utils/booking/booking.utils';
import { combineDateWithTime } from '../../../utils/booking/calculateBooking.utils';
import { User } from '../../../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';
// import {
//   checkBookingConflict,
//   isValidTimeRange,
//   generateBookingReference
// } from '../../../utils/booking/booking.utils';

/**
 * Branch Admin Booking Controller
 * Handles operations that branch admins can perform with real-time updates via WebSockets
 */

export const getBranchBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { branchId } = req.params;

    // Get all bookings for fields in this branch
    const bookings = await prisma.booking.findMany({
      where: {
        field: {
          branchId: parseInt(branchId),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBranchBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id, branchId } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(id),
        field: {
          branchId: parseInt(branchId),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const updateBranchBookingStatus = async (
  req: User,
  res: Response,
): Promise<void> => {
  try {
    const { id, branchId } = req.params;
    const { paymentStatus } = req.body;

    // Verify the booking belongs to this branch
    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(id),
        field: {
          branchId: parseInt(branchId),
        },
      },
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
    const updatedBooking = await getCompleteBooking(parseInt(id));

    // Emit WebSocket event for booking update
    emitBookingEvents('update-payment', {
      booking: updatedBooking,
      userId: booking.user?.id,
      branchId,
      paymentStatus,
    });

    // Hapus cache yang terkait booking
    deleteCachedDataByPattern('booking');
    deleteCachedDataByPattern('fields_availability');
    deleteCachedDataByPattern('user_bookings');
    deleteCachedDataByPattern('branch_bookings');
    deleteCachedDataByPattern('admin_all_bookings');

    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 400, 'Failed to update booking');
  }
};

export const createManualBooking = async (
  req: User,
  res: Response,
): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus } =
      req.body;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(
      parseInt(fieldId.toString()),
      parseInt(branchId),
    );

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found in this branch');
    }

    const bookingDateTime = new Date(bookingDate);
    console.log('📆 Booking Date:', bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime,
    );

    if (!timeValidation.valid) {
      return sendErrorResponse(
        res,
        400,
        timeValidation.message,
        timeValidation.details,
      );
    }

    // Create booking and payment records
    const { booking, payment } = await createBookingWithPayment(
      parseInt(userId.toString()),
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime,
      paymentStatus || 'paid',
      'cash',
      field.priceDay,
    );

    // Get complete booking with relations
    const completeBooking = await getCompleteBooking(booking.id);

    // Emit WebSocket events
    emitBookingEvents('new-booking', {
      booking: completeBooking,
      userId: parseInt(userId.toString()),
      fieldId: parseInt(fieldId.toString()),
      branchId: parseInt(branchId),
      bookingDate: bookingDateTime,
      startTime: startDateTime,
      endTime: endDateTime,
    });

    // Hapus cache yang terkait booking
    deleteCachedDataByPattern('booking');
    deleteCachedDataByPattern('fields_availability');
    deleteCachedDataByPattern('user_bookings');
    deleteCachedDataByPattern('branch_bookings');
    deleteCachedDataByPattern('admin_all_bookings');

    res.status(201).json({ booking, payment });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Failed to create manual booking');
  }
};
