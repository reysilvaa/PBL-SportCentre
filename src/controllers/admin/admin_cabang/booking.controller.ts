import { Request, Response } from 'express';
import prisma from '../../../config/database';

/**
 * Branch Admin Booking Controller
 * Handles operations that branch admins can perform
 */

export const getBranchBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    
    // Ensure the admin is authorized for this branch (should be done in middleware)
    
    // Get all bookings for fields in this branch
    const bookings = await prisma.booking.findMany({
      where: {
        field: {
          branchId: parseInt(branchId)
        }
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
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

export const getBranchBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { branchId } = req.params; // Or from admin's profile
    
    const booking = await prisma.booking.findFirst({
      where: { 
        id: parseInt(id),
        field: {
          branchId: parseInt(branchId)
        }
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true
      }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found for this branch' });
      return;
    }
    
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateBranchBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { branchId } = req.params; // Or from admin's profile
    const { paymentStatus } = req.body;
    
    // Verify the booking belongs to this branch
    const booking = await prisma.booking.findFirst({
      where: { 
        id: parseInt(id),
        field: {
          branchId: parseInt(branchId)
        }
      },
      include: { payment: true }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found for this branch' });
      return;
    }
    
    // Update payment status
    if (booking.payment && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: paymentStatus }
      });
    }
    
    // Return updated booking
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { 
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true 
      }
    });
    
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update booking' });
  }
};

export const createManualBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params; // Or from admin's profile
    const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus } = req.body;
    
    // Verify the field belongs to this branch
    const field = await prisma.field.findFirst({
      where: { 
        id: parseInt(fieldId.toString()),
        branchId: parseInt(branchId)
      }
    });
    
    if (!field) {
      res.status(404).json({ error: 'Field not found in this branch' });
      return;
    }
    
    // Continue with booking creation (similar to user createBooking but simpler)
    const bookingDateTime = new Date(bookingDate);
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    
    // Create booking
    const newBooking = await prisma.booking.create({
      data: { 
        userId: parseInt(userId.toString()), 
        fieldId: parseInt(fieldId.toString()), 
        bookingDate: bookingDateTime, 
        startTime: startDateTime, 
        endTime: endDateTime 
      }
    });
    
    // Create payment with provided status (e.g. for cash payments)
    const payment = await prisma.payment.create({ 
      data: { 
        bookingId: newBooking.id, 
        userId: parseInt(userId.toString()), 
        amount: field.priceDay, // Simplified for manual bookings
        status: paymentStatus || 'pending', 
        paymentMethod: 'cash' // Default for manual bookings
      } 
    });
    
    res.status(201).json({ booking: newBooking, payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create manual booking' });
  }
};