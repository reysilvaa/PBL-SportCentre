import { Request, Response } from 'express';
import prisma from '../../../config/services/database';
import { updateBookingPaymentSchema } from '../../../zod-schemas/bookingPayment.schema';
import { invalidateBookingCache, invalidatePaymentCache } from '../../../utils/cache/cacheInvalidation.utils';

/**
 * Super Admin Booking Controller
 * Handles operations that super admins can perform
 */

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

    res.json(bookings);
  } catch (error) {
    console.error('Error in getAllBookings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBookingById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { include: { branch: true } },
        payment: true,
      },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking tidak ditemukan' });
      return;
    }

    res.json(booking);
  } catch (error) {
    console.error('Error in getBookingById:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
        error: 'Validasi gagal',
        details: result.error.format(),
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
      res.status(404).json({ error: 'Booking tidak ditemukan' });
      return;
    }

    if (!booking.payment) {
      res.status(404).json({ error: 'Pembayaran tidak ditemukan' });
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

    // Invalidasi cache setelah update
    await invalidatePaymentCache(
      booking.payment.id,
      bookingId,
      booking.field.id,
      booking.field.branchId,
      booking.userId
    );

    res.json({
      booking,
      payment: updatedPayment,
    });
  } catch (error) {
    console.error('Error in updateBookingPayment:', error);
    res.status(400).json({ error: 'Gagal memperbarui pembayaran booking' });
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
      res.status(404).json({ error: 'Booking tidak ditemukan' });
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

    // Invalidasi cache setelah delete
    await invalidateBookingCache(bookingId, fieldId, branchId, userId);
    if (paymentId) {
      await invalidatePaymentCache(paymentId);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in deleteBooking:', error);
    res.status(400).json({ error: 'Gagal menghapus booking' });
  }
};

// Additional admin functions for reporting
export const getBookingStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;

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

    // Get total bookings count
    const totalBookings = await prisma.booking.count({ where });

    // Get bookings by payment status
    const bookingsByStatus = await prisma.$queryRaw`
      SELECT p.status, COUNT(*) as count 
      FROM Payment p
      JOIN Booking b ON p.bookingId = b.id
      ${branchId ? `JOIN Field f ON b.fieldId = f.id AND f.branchId = ${parseInt(branchId as string)}` : ''}
      ${startDate && endDate ? `WHERE b.bookingDate BETWEEN ${new Date(startDate as string)} AND ${new Date(endDate as string)}` : ''}
      GROUP BY p.status
    `;

    // Get total revenue
    const revenue = await prisma.payment.aggregate({
      where: {
        status: 'paid',
        booking: where,
      },
      _sum: {
        amount: true,
      },
    });

    res.json({
      totalBookings,
      bookingsByStatus,
      totalRevenue: revenue._sum.amount || 0,
    });
  } catch (error) {
    console.error('Error in getBookingStats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
