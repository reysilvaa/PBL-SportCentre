import { Request, Response } from 'express';
import prisma from '../../../config/database';

/**
 * Super Admin Booking Controller
 * Handles operations that super admins can perform
 */

export const getAllBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId, status } = req.query;
    
    // Build filter conditions
    const where: any = {};
    
    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    if (branchId) {
      where.field = {
        branchId: parseInt(branchId as string)
      };
    }
    
    if (status) {
      where.payment = {
        status: status as string
      };
    }
    
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } },
        payment: true
      },
      orderBy: { bookingDate: 'desc' }
    });
    
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { include: { branch: true } },
        payment: true
      }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod, amount } = req.body;
    
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { payment: true }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // Update payment details
    const updatedPayment = await prisma.payment.update({
      where: { id: booking.payment?.id },
      data: { 
        status: paymentStatus || booking.payment?.status,
        paymentMethod: paymentMethod || booking.payment?.paymentMethod,
        amount: amount ? parseFloat(amount.toString()) : booking.payment?.amount
      }
    });
    
    res.json({
      booking,
      payment: updatedPayment
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update booking payment' });
  }
};

export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // First check if booking exists and has a payment
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { payment: true }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // If there's a payment, delete it first (transaction would be better)
    if (booking.payment) {
      await prisma.payment.delete({
        where: { id: booking.payment.id }
      });
    }
    
    // Then delete the booking
    await prisma.booking.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete booking' });
  }
};

// Additional admin functions for reporting
export const getBookingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    // Build filter conditions
    const where: any = {};
    
    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    if (branchId) {
      where.field = {
        branchId: parseInt(branchId as string)
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
        booking: where
      },
      _sum: {
        amount: true
      }
    });
    
    res.json({
      totalBookings,
      bookingsByStatus,
      totalRevenue: revenue._sum.amount || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};