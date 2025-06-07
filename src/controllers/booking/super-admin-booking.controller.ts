import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { updateBookingPaymentSchema } from '../../zod-schemas/bookingPayment.schema';
import { emitBookingEvents } from '../../utils/booking/booking.utils';
import { invalidateBookingCache, invalidatePaymentCache } from '../../utils/cache/cacheInvalidation.utils';
import { PaymentMethod, PaymentStatus } from '../../types';
import * as UnifiedStatsService from '../../repositories/statistics/unifiedStats.service';

/**
 * Super Admin Booking Controller
 * Berisi semua operasi booking yang hanya dapat dilakukan oleh super admin
 */

export const getAllBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId, status } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;

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
      console.log('Adding branch filter:', where.field);
    }

    if (status) {
      where.payment = {
        status: status as PaymentStatus,
      };
    }

    const totalItems = await prisma.booking.count({
      where,
    });

    const bookings = await prisma.booking.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true, type: true } },
        payment: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data semua booking',
      data: bookings,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error in getAllBookings:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

export const updateBookingPayment = async (req: Request, res: Response): Promise<void> => {
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
        field: { select: { id: true, branchId: true } },
      },
    });

    if (!booking) {
      res.status(404).json({
        status: false,
        message: 'Booking tidak ditemukan',
      });
      return;
    }

    if (!booking.payment) {
      res.status(404).json({
        status: false,
        message: 'Pembayaran tidak ditemukan',
      });
      return;
    }

    const updateData: any = {
      status: (result.data.paymentStatus as PaymentStatus) || booking.payment.status,
      amount: result.data.amount !== undefined ? result.data.amount : booking.payment.amount,
    };
    
    if (result.data.paymentMethod) {
      updateData.paymentMethod = result.data.paymentMethod as PaymentMethod;
    }
    
    // Update payment details
    const updatedPayment = await prisma.payment.update({
      where: { id: booking.payment.id },
      data: updateData,
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
      },
    });
  } catch (error) {
    console.error('Error in updateBookingPayment:', error);
    res.status(400).json({
      status: false,
      message: 'Gagal memperbarui pembayaran booking',
    });
  }
};

export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    // First check if booking exists and has a payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
        field: { select: { id: true, branchId: true } },
      },
    });

    if (!booking) {
      res.status(404).json({
        status: false,
        message: 'Booking tidak ditemukan',
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
      message: 'Gagal menghapus booking',
    });
  }
};

export const getBookingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await UnifiedStatsService.getBookingStats();

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan statistik booking',
      data: stats,
    });
  } catch (error) {
    console.error('Error in getBookingStats:', error);
    res.status(500).json({
      status: false,
      message: 'Gagal mendapatkan statistik booking',
    });
  }
};
