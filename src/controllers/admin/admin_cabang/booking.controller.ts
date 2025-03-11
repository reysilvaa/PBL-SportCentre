import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { getIO } from '../../../config/socket';
import { isFieldAvailable } from '../../../utils/availability.utils';
import { combineDateWithTime } from '../../..//utils/bookingDate.utils';

/**
 * Branch Admin Booking Controller
 * Handles operations that branch admins can perform with real-time updates via WebSockets
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
      include: { 
        payment: true,
        user: { select: { id: true } },
        field: true
      }
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
    
    // Emit WebSocket event to notify clients about the booking update
    const io = getIO();
    
    // Emit to branch channel
    io.to(`branch-${branchId}`).emit('booking:updated', updatedBooking);
    
    // Emit to user's personal channel
    if (booking.user?.id) {
      io.to(`user-${booking.user.id}`).emit('booking:updated', {
        bookingId: updatedBooking?.id,
        paymentStatus: updatedBooking?.payment?.status,
        message: `Your booking payment status has been updated to: ${updatedBooking?.payment?.status}`
      });
    }
    
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
    
    const bookingDateTime = new Date(bookingDate);
    console.log("📆 Booking Date:", bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);
    
    // Validate start and end times
    if (startDateTime >= endDateTime) {
      res.status(400).json({ 
        error: 'End time must be after start time',
        details: { 
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        }
      });
      return;
    }
    
    // Log booking duration for debugging
    console.log("⏰ Booking duration check:", {
      start: startDateTime,
      end: endDateTime,
      durationMinutes: (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60)
    });
    
    // Check field availability before creating booking
    const isAvailable = await isFieldAvailable(
      parseInt(fieldId.toString()), 
      bookingDateTime, 
      startDateTime, 
      endDateTime
    );
    
    console.log("🔍 Field availability result:", isAvailable);
    
    if (!isAvailable) {
      res.status(400).json({ 
        error: 'Field is already booked for the selected time slot',
        details: {
          fieldId,
          date: bookingDateTime,
          startTime: startDateTime,
          endTime: endDateTime
        }
      });
      return;
    }
    
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
        status: paymentStatus || 'paid', 
        paymentMethod: 'cash',// Default for manual bookings
      } 
    });
    
    // Fetch complete booking with relations for the WebSocket event
    const completeBooking = await prisma.booking.findUnique({
      where: { id: newBooking.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true
      }
    });
    
    // Emit WebSocket event to notify clients about the new booking
    const io = getIO();
    
    // Emit to branch channel
    io.to(`branch-${branchId}`).emit('booking:created', completeBooking);
    
    // Emit to user's personal channel
    io.to(`user-${userId}`).emit('booking:created', {
      booking: completeBooking,
      message: `A new booking has been created for you by the branch admin`
    });
    
    // Emit to field availability channel
    io.to(`field-${fieldId}`).emit('field:availability-changed', {
      fieldId: parseInt(fieldId.toString()),
      date: bookingDateTime,
      startTime: startDateTime,
      endTime: endDateTime,
      available: false
    });
    
    res.status(201).json({ booking: newBooking, payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create manual booking' });
  }
};

/**
 * Setup WebSocket handlers for branch bookings
 */
export const setupBranchBookingSocketHandlers = (): void => {
  const io = getIO();
  const branchNamespace = io.of('/branches');
  
  
  branchNamespace.on('connection', (socket) => {
    console.log(`🏢 Branch admin connected: ${socket.id}`);
    
    // Join branch-specific room
    const branchId = socket.data.user.branchId;
    if (branchId) {
      socket.join(`branch-${branchId}`);
      console.log(`Admin joined branch-${branchId} room`);
    }
    
    // Handle booking search request
    socket.on('booking:search', async (data) => {
      try {
        const { query, branchId } = data;
        
        // Search bookings by user name, email, or booking ID
        const bookings = await prisma.booking.findMany({
          where: {
            field: {
              branchId: parseInt(branchId)
            },
            OR: [
              { id: isNaN(parseInt(query)) ? undefined : parseInt(query) },
              { user: { name: { contains: query } } },
              { user: { email: { contains: query } } }
            ]
          },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            field: true,
            payment: true
          },
          take: 20
        });
        
        // Send results back to the client
        socket.emit('booking:search-results', bookings);
      } catch (error) {
        console.error('Search error:', error);
        socket.emit('booking:search-error', { message: 'Failed to search bookings' });
      }
    });
    
    // Add a new handler for checking field availability
    socket.on('field:check-availability', async (data) => {
      try {
        const { fieldId, bookingDate, startTime, endTime } = data;
        
        // Convert to proper date objects
        const bookingDateTime = new Date(bookingDate);
        // Ensure bookingDate only contains the date part
        bookingDateTime.setHours(0, 0, 0, 0);
        
        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        
        // Validate time range
        if (startDateTime >= endDateTime) {
          socket.emit('field:availability-error', {
            message: 'End time must be after start time',
            details: {
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString()
            }
          });
          return;
        }
        
        // Check field availability
        const isAvailable = await isFieldAvailable(
          parseInt(fieldId.toString()),
          bookingDateTime,
          startDateTime,
          endDateTime
        );
        
        // Send availability result back to client
        socket.emit('field:availability-result', {
          fieldId,
          bookingDate: bookingDateTime.toISOString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          isAvailable
        });
      } catch (error) {
        console.error('Availability check error:', error);
        socket.emit('field:availability-error', { 
          message: 'Failed to check field availability',
          error: error
        });
      }
    });
    
    // Handle real-time booking statistics request
    socket.on('booking:stats', async (data) => {
      try {
        const { branchId } = data;
        
        // Get today's date at 00:00
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get booking statistics
        const todayBookings = await prisma.booking.count({
          where: {
            field: { branchId: parseInt(branchId) },
            bookingDate: { gte: today }
          }
        });
        
        const pendingPayments = await prisma.booking.count({
          where: {
            field: { branchId: parseInt(branchId) },
            payment: { status: 'pending' }
          }
        });
        
        // Send stats back to the client
        socket.emit('booking:stats-results', {
          todayBookings,
          pendingPayments
        });
      } catch (error) {
        console.error('Stats error:', error);
        socket.emit('booking:stats-error', { message: 'Failed to fetch booking statistics' });
      }
    });
    
    // Handle manual booking creation via socket
    socket.on('booking:create-manual', async (data) => {
      try {
        const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus, branchId } = data;
        
        // Verify the field belongs to this branch
        const field = await prisma.field.findFirst({
          where: { 
            id: parseInt(fieldId.toString()),
            branchId: parseInt(branchId)
          }
        });
        
        if (!field) {
          socket.emit('booking:create-error', { 
            message: 'Field not found in this branch'
          });
          return;
        }
        
        // Convert to proper date objects
        const bookingDateTime = new Date(bookingDate);
        // Ensure bookingDate only contains the date part
        bookingDateTime.setHours(0, 0, 0, 0);
        
        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        
        // Validate time range
        if (startDateTime >= endDateTime) {
          socket.emit('booking:create-error', {
            message: 'End time must be after start time',
            details: {
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString()
            }
          });
          return;
        }
        
        // Log booking duration for debugging
        console.log("⏰ Booking duration check (socket):", {
          field: parseInt(fieldId.toString()),
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          durationMinutes: (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60)
        });
        
        // Check field availability before creating booking
        const isAvailable = await isFieldAvailable(
          parseInt(fieldId.toString()), 
          bookingDateTime, 
          startDateTime, 
          endDateTime
        );
        
        console.log("🔍 Field availability result (socket):", isAvailable);
        
        if (!isAvailable) {
          socket.emit('booking:create-error', { 
            message: 'Field is already booked for the selected time slot',
            details: {
              fieldId,
              date: bookingDateTime.toISOString(),
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString() 
            }
          });
          return;
        }
        
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
        
        // Create payment
        const payment = await prisma.payment.create({ 
          data: { 
            bookingId: newBooking.id, 
            userId: parseInt(userId.toString()), 
            amount: field.priceDay, 
            status: paymentStatus || 'paid', 
            paymentMethod: 'cash'
          } 
        });
        
        // Fetch complete booking
        const completeBooking = await prisma.booking.findUnique({
          where: { id: newBooking.id },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            field: true,
            payment: true
          }
        });
        
        // Emit to current client
        socket.emit('booking:create-success', completeBooking);
        
        // Emit to branch channel
        socket.to(`branch-${branchId}`).emit('booking:created', completeBooking);
        
        // Emit to user's personal channel
        io.to(`user-${userId}`).emit('booking:created', {
          booking: completeBooking,
          message: `A new booking has been created for you by the branch admin`
        });
        
        // Emit to field availability channel
        io.to(`field-${fieldId}`).emit('field:availability-changed', {
          fieldId: parseInt(fieldId.toString()),
          date: bookingDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
          available: false
        });
      } catch (error) {
        console.error('Create booking error:', error);
        socket.emit('booking:create-error', { 
          message: 'Failed to create manual booking',
          error: error
        });
      }
    });
    
    // Handle admin leaving
    socket.on('disconnect', () => {
      console.log(`🏢 Branch admin disconnected: ${socket.id}`);
      if (branchId) {
        socket.leave(`branch-${branchId}`);
      }
    });
  });
};