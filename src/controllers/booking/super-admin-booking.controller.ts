import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { updateBookingPaymentSchema } from '../../zod-schemas/bookingPayment.schema';
import { emitBookingEvents } from '../../utils/booking/booking.utils';
import { invalidateBookingCache, invalidatePaymentCache } from '../../utils/cache/cacheInvalidation.utils';
import { PaymentMethod, PaymentStatus } from '../../types';

/**
 * Super Admin Booking Controller
 * Berisi semua operasi booking yang hanya dapat dilakukan oleh super admin
 */

export const getAllBookings = async (req: Request, res: Response): Promise<void> => {
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
        status: status as PaymentStatus,
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

    // Update payment details
    const updatedPayment = await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        status: result.data.paymentStatus as PaymentStatus || booking.payment.status,
        paymentMethod: result.data.paymentMethod as PaymentMethod || booking.payment.paymentMethod,
        amount: result.data.amount !== undefined ? result.data.amount : booking.payment.amount,
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
      booking.userId,
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
          status: PaymentStatus.PAID,
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

      const branchRevenue = revenueByBranch.reduce(
        (acc, payment) => {
          const branchId = payment.booking?.field?.branch?.id;
          const branchName = payment.booking?.field?.branch?.name;

          if (branchId && branchName) {
            if (!acc[branchId]) {
              acc[branchId] = { id: branchId, name: branchName, total: 0 };
            }
            acc[branchId].total += Number(payment.amount);
          }
          return acc;
        },
        {} as Record<number, { id: number; name: string; total: number }>,
      );

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
