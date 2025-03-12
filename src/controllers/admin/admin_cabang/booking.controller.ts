import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { getIO } from '../../../config/socket';
import { 
  sendErrorResponse,
  verifyFieldBranch,
  validateBookingTime,
  createBookingWithPayment,
  getCompleteBooking,
  emitBookingEvents
} from '../../../utils/booking/booking.utils';
import { combineDateWithTime } from '../../../utils/booking/calculateBooking.utils';

/**
 * Branch Admin Booking Controller
 * Handles operations that branch admins can perform with real-time updates via WebSockets
 */

export const getBranchBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    
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
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBranchBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, branchId } = req.params;
    
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
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }
    
    res.json(booking);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const updateBranchBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, branchId } = req.params;
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
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }
    
    // Update payment status
    if (booking.payment && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: paymentStatus }
      });
    }
    
    // Return updated booking
    const updatedBooking = await getCompleteBooking(parseInt(id));
    
    // Emit WebSocket event for booking update
    emitBookingEvents('update-payment', {
      booking: updatedBooking,
      userId: booking.user?.id,
      branchId,
      paymentStatus
    });
    
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 400, 'Failed to update booking');
  }
};

export const createManualBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { fieldId, userId, bookingDate, startTime, endTime, paymentStatus } = req.body;
    
    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(parseInt(fieldId.toString()), parseInt(branchId));
    
    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found in this branch');
    }
    
    const bookingDateTime = new Date(bookingDate);
    console.log("📆 Booking Date:", bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);
    
    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime
    );
    
    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
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
      field.priceDay
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
      endTime: endDateTime
    });
    
    res.status(201).json({ booking, payment });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, 'Failed to create manual booking');
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
        bookingDateTime.setHours(0, 0, 0, 0);
        
        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        
        // Validate booking time and availability
        const timeValidation = await validateBookingTime(
          parseInt(fieldId.toString()),
          bookingDateTime,
          startDateTime,
          endDateTime
        );
        
        if (!timeValidation.valid) {
          socket.emit('field:availability-error', {
            message: timeValidation.message,
            details: timeValidation.details
          });
          return;
        }
        
        // Send availability result back to client
        socket.emit('field:availability-result', {
          fieldId,
          bookingDate: bookingDateTime.toISOString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          isAvailable: true
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
        const field = await verifyFieldBranch(parseInt(fieldId.toString()), parseInt(branchId));
        
        if (!field) {
          socket.emit('booking:create-error', { 
            message: 'Field not found in this branch'
          });
          return;
        }
        
        // Convert to proper date objects
        const bookingDateTime = new Date(bookingDate);
        bookingDateTime.setHours(0, 0, 0, 0);
        
        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        
        // Validate booking time and availability
        const timeValidation = await validateBookingTime(
          parseInt(fieldId.toString()),
          bookingDateTime,
          startDateTime,
          endDateTime
        );
        
        if (!timeValidation.valid) {
          socket.emit('booking:create-error', {
            message: timeValidation.message,
            details: timeValidation.details
          });
          return;
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
          field.priceDay
        );
        
        // Get complete booking with relations
        const completeBooking = await getCompleteBooking(booking.id);
        
        // Emit to current client
        socket.emit('booking:create-success', completeBooking);
        
        // Emit WebSocket events
        emitBookingEvents('new-booking', {
          booking: completeBooking,
          userId: parseInt(userId.toString()),
          fieldId: parseInt(fieldId.toString()),
          branchId: parseInt(branchId),
          bookingDate: bookingDateTime,
          startTime: startDateTime,
          endTime: endDateTime
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