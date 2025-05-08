import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { createBookingSchema } from '../zod-schemas/booking.schema';
import { updateBookingPaymentSchema } from '../zod-schemas/bookingPayment.schema';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  processMidtransPayment,
  emitBookingEvents,
  getCompleteBooking,
  verifyFieldBranch,
} from '../utils/booking/booking.utils';
import { calculateTotalPrice, combineDateWithTime } from '../utils/booking/calculateBooking.utils';
import { PaymentStatus } from '@prisma/client';
import { parseISO, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  TIMEZONE,
  formatDateToWIB,
  combineDateWithTimeWIB,
} from '../utils/variables/timezone.utils';
import { 
  invalidateBookingCache, 
  invalidatePaymentCache 
} from '../utils/cache/cacheInvalidation.utils';
import {
  trackFailedBooking,
  resetFailedBookingCounter,
} from '../middlewares/security.middleware';
import * as RevenueService from '../repositories/revenue/revenueReports.service';
import { validateDateRange } from '../repositories/revenue/validation.utils';
import { User } from '../middlewares/auth.middleware';

/**
 * Unified Booking Controller
 * Menggabungkan fungsionalitas dari semua controller booking yang ada
 * dengan menggunakan middleware permission untuk kontrol akses
 */

// =============== USER OPERATIONS =============== //

export const createBooking = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    console.log('📥 Request body:', req.body);

    // Validasi data dengan Zod
    const result = createBookingSchema.safeParse(req.body);

    if (!result.success) {
      return sendErrorResponse(
        res,
        400,
        'Validasi gagal',
        result.error.format()
      );
    }

    const { userId, fieldId, bookingDate, startTime, endTime } = result.data;

    // Convert strings to Date objects
    const bookingDateTime = parseISO(bookingDate);
    console.log('📆 Booking Date (WIB):', formatDateToWIB(bookingDateTime));

    // Combine date with time in WIB timezone
    const startDateTime = toZonedTime(
      combineDateWithTimeWIB(bookingDateTime, startTime),
      TIMEZONE
    );

    const endDateTime = toZonedTime(
      combineDateWithTimeWIB(bookingDateTime, endTime),
      TIMEZONE
    );

    console.log('⏰ Start Time (WIB):', formatDateToWIB(startDateTime));
    console.log('⏰ End Time (WIB):', formatDateToWIB(endDateTime));

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime
    );

    if (!timeValidation.valid) {
      return sendErrorResponse(
        res,
        400,
        timeValidation.message,
        timeValidation.details
      );
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
      'pending',
      'midtrans',
      totalPrice
    );

    console.log('✅ Booking created:', booking.id);
    console.log('💳 Payment created:', payment.id);

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
        status: 'pending',
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
          status: 'pending',
        },
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error', error);
  }
};

export const getUserBookings = async (
  req: User,
  res: Response
): Promise<void> => {
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

export const getBookingById = async (
  req: User,
  res: Response
): Promise<void> => {
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

export const cancelBooking = async (
  req: User,
  res: Response
): Promise<void> => {
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
    if (booking.payment?.status === 'paid') {
      return sendErrorResponse(
        res,
        400,
        'Cannot cancel a booking that has been paid. Please contact administrator.'
      );
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
    await invalidateBookingCache(
      bookingId,
      booking.field.id,
      booking.field.branchId,
      booking.userId
    );

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

// =============== BRANCH ADMIN OPERATIONS =============== //

export const getBranchBookings = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    // Dari middleware auth kita sudah punya branchId di req.userBranch
    const branchId = req.userBranch?.id;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat melihat booking dari branch tertentu
    const whereCondition = branchId === 0 && req.query.branchId
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

export const getBranchBookingById = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat melihat booking dari branch tertentu
    const whereCondition = branchId === 0
      ? { id: bookingId }
      : { id: bookingId, field: { branchId } };

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

export const updateBranchBookingStatus = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;
    const { paymentStatus } = req.body;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat mengupdate booking dari branch tertentu
    const whereCondition = branchId === 0
      ? { id: bookingId }
      : { id: bookingId, field: { branchId } };

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
    await invalidateBookingCache(
      bookingId,
      booking.fieldId,
      booking.field.branchId,
      booking.userId
    );

    res.status(200).json({
      status: true,
      message: 'Status booking berhasil diperbarui',
      data: updatedBooking
    });
  } catch (error) {
    console.error('Error updating branch booking status:', error);
    sendErrorResponse(res, 400, 'Failed to update booking');
  }
};

export const createManualBooking = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    const branchId = req.userBranch?.id;
    const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus } =
      req.body;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat membuat booking untuk branch tertentu
    const whereBranchCondition = branchId === 0 && req.body.branchId
      ? parseInt(req.body.branchId)
      : branchId;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(
      parseInt(fieldId),
      whereBranchCondition
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
      parseInt(fieldId),
      bookingDateTime,
      startDateTime,
      endDateTime
    );

    if (!timeValidation.valid) {
      return sendErrorResponse(
        res,
        400,
        timeValidation.message,
        timeValidation.details
      );
    }

    // Calculate price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
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
      totalPrice
    );

    // Emit real-time events
    emitBookingEvents('booking:created', { booking, payment });

    // Invalidate cache
    await invalidateBookingCache(
      booking.id,
      parseInt(fieldId),
      whereBranchCondition,
      parseInt(userId)
    );

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

// =============== SUPER ADMIN OPERATIONS =============== //

export const getAllBookings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate, branchId, status } = req.query;

    // Build filter conditions
    const where: any = {};

    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (branchId) {
      where.field = {
        branchId: parseInt(branchId as string),
      };
    }

    if (status) {
      where.payment = {
        status: status as string,
      };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } },
        payment: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data semua booking',
      data: bookings,
    });
  } catch (error) {
    console.error('Error in getAllBookings:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const updateBookingPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    // Validasi data dengan Zod
    const result = updateBookingPaymentSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
      });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        payment: true,
        field: { select: { id: true, branchId: true } }
      },
    });

    if (!booking) {
      res.status(404).json({ 
        status: false,
        message: 'Booking tidak ditemukan' 
      });
      return;
    }

    if (!booking.payment) {
      res.status(404).json({ 
        status: false,
        message: 'Pembayaran tidak ditemukan' 
      });
      return;
    }

    // Update payment details
    const updatedPayment = await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        status: result.data.paymentStatus || booking.payment.status,
        paymentMethod:
          result.data.paymentMethod || booking.payment.paymentMethod,
        amount:
          result.data.amount !== undefined
            ? result.data.amount
            : booking.payment.amount,
      },
    });

    // Emit WebSocket event for booking update
    emitBookingEvents('update-payment', {
      booking,
      userId: booking.userId,
      branchId: booking.field.branchId,
      paymentStatus: updatedPayment.status,
    });

    // Invalidasi cache setelah update
    await invalidatePaymentCache(
      booking.payment.id,
      bookingId,
      booking.field.id,
      booking.field.branchId,
      booking.userId
    );

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui pembayaran booking',
      data: {
        booking,
        payment: updatedPayment,
      }
    });
  } catch (error) {
    console.error('Error in updateBookingPayment:', error);
    res.status(400).json({ 
      status: false,
      message: 'Gagal memperbarui pembayaran booking' 
    });
  }
};

export const deleteBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    // First check if booking exists and has a payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        payment: true,
        field: { select: { id: true, branchId: true } }
      },
    });

    if (!booking) {
      res.status(404).json({ 
        status: false,
        message: 'Booking tidak ditemukan' 
      });
      return;
    }

    // Save IDs for cache invalidation
    const fieldId = booking.field.id;
    const branchId = booking.field.branchId;
    const userId = booking.userId;
    const paymentId = booking.payment?.id;

    // If there's a payment, delete it first (transaction would be better)
    if (booking.payment) {
      await prisma.payment.delete({
        where: { id: booking.payment.id },
      });
    }

    // Then delete the booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    // Emit booking cancelled event
    emitBookingEvents('booking:deleted', { bookingId });

    // Invalidasi cache setelah delete
    await invalidateBookingCache(bookingId, fieldId, branchId, userId);
    if (paymentId) {
      await invalidatePaymentCache(paymentId);
    }

    res.status(200).json({
      status: true,
      message: 'Booking berhasil dihapus',
    });
  } catch (error) {
    console.error('Error in deleteBooking:', error);
    res.status(500).json({ 
      status: false,
      message: 'Gagal menghapus booking' 
    });
  }
};

export const getBookingStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await prisma.$transaction(async (prisma) => {
      // Total bookings
      const totalBookings = await prisma.booking.count();

      // Bookings by status
      const bookingsByStatus = await prisma.payment.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      // Bookings by date (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const bookingsByDate = await prisma.booking.groupBy({
        by: ['bookingDate'],
        where: {
          bookingDate: {
            gte: thirtyDaysAgo,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          bookingDate: 'asc',
        },
      });

      // Revenue by branch
      const revenueByBranch = await prisma.payment.findMany({
        where: {
          status: 'paid',
        },
        select: {
          amount: true,
          booking: {
            select: {
              field: {
                select: {
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const branchRevenue = revenueByBranch.reduce((acc, payment) => {
        const branchId = payment.booking?.field?.branch?.id;
        const branchName = payment.booking?.field?.branch?.name;
        
        if (branchId && branchName) {
          if (!acc[branchId]) {
            acc[branchId] = { id: branchId, name: branchName, total: 0 };
          }
          acc[branchId].total += Number(payment.amount);
        }
        return acc;
      }, {} as Record<number, { id: number; name: string; total: number }>);

      return {
        totalBookings,
        bookingsByStatus: bookingsByStatus.map((item) => ({
          status: item.status,
          count: item._count.id,
        })),
        bookingsByDate: bookingsByDate.map((item) => ({
          date: item.bookingDate,
          count: item._count.id,
        })),
        revenueByBranch: Object.values(branchRevenue),
      };
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan statistik booking',
      data: stats
    });
  } catch (error) {
    console.error('Error in getBookingStats:', error);
    res.status(500).json({ 
      status: false,
      message: 'Gagal mendapatkan statistik booking' 
    });
  }
};

// =============== OWNER OPERATIONS =============== //

// export const getRevenueReports = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { startDate, endDate, type } = req.query;
//     const branchId = req.userBranch?.id;

//     if (!validateDateRange(startDate as string, endDate as string, res)) return;

//     const start = new Date(startDate as string);
//     const end = new Date(endDate as string);

//     // Owner hanya bisa melihat data cabang mereka sendiri
//     // Super admin bisa melihat data semua cabang atau pilih specific branch
//     const targetBranchId = req.user?.role === 'super_admin' && req.query.branchId
//       ? parseInt(req.query.branchId as string)
//       : branchId;

//     const result = await RevenueService.generateRevenueReport(
//       start,
//       end,
//       type as string,
//       targetBranchId !== 0 ? targetBranchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan pendapatan',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting revenue reports:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getOccupancyReports = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { startDate, endDate } = req.query;
//     const branchId = req.userBranch?.id;

//     if (!validateDateRange(startDate as string, endDate as string, res)) return;

//     const start = new Date(startDate as string);
//     const end = new Date(endDate as string);
    
//     // Owner hanya bisa melihat data cabang mereka sendiri
//     // Super admin bisa melihat data semua cabang atau pilih specific branch
//     const targetBranchId = req.user?.role === 'super_admin' && req.query.branchId
//       ? parseInt(req.query.branchId as string)
//       : branchId;

//     const result = await RevenueService.generateOccupancyReport(
//       start,
//       end,
//       targetBranchId !== 0 ? targetBranchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan okupansi',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting occupancy reports:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getBusinessPerformance = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const branchId = req.userBranch?.id;

//     // Get branch-specific performance for owners
//     const result = await RevenueService.generateBusinessPerformanceReport(
//       branchId !== 0 ? branchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan performa bisnis',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting business performance:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getBookingForecast = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const branchId = req.userBranch?.id;

//     // Get branch-specific forecast for owners
//     const result = await RevenueService.generateBookingForecast(
//       branchId !== 0 ? branchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan prediksi booking',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting booking forecast:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// }; 