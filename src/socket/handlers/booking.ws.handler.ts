import { Namespace } from 'socket.io';
import prisma from '../../config/database';
import { isFieldAvailable } from '../../utils/availability.utils';
import { combineDateWithTime, calculateTotalPrice } from '../../utils/bookingDate.utils';
import { PaymentStatus } from '@prisma/client';

export function setupBookingHandlers(namespace: Namespace) {
  namespace.on('connection', (socket) => {
    console.log(`User connected to bookings namespace: ${socket.data.user.id}`);

    // Join a room specific to the user for targeted updates
    socket.join(`user-${socket.data.user.id}`);

    // Check field availability
    socket.on('check-availability', async (data, callback) => {
      try {
        const { fieldId, bookingDate, startTime, endTime } = data;
        
        if (!fieldId || !bookingDate || !startTime || !endTime) {
          return callback({ 
            status: 'error', 
            message: 'Missing required fields' 
          });
        }
        
        const date = new Date(bookingDate);
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        const isAvailable = await isFieldAvailable(
          Number(fieldId), 
          date, 
          start, 
          end
        );
        
        callback({ 
          status: 'success', 
          data: { isAvailable } 
        });
      } catch (error) {
        console.error('Check availability error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to check availability' 
        });
      }
    });

    // Get available time slots
    socket.on('get-available-slots', async (data, callback) => {
      try {
        const { fieldId, date } = data;
        
        if (!fieldId || !date) {
          return callback({ 
            status: 'error', 
            message: 'Field ID and date are required' 
          });
        }
        
        const bookingDate = new Date(date);
        const dateString = bookingDate.toISOString().split('T')[0];
        
        // Get all bookings for the field on the specified date
        const existingBookings = await prisma.booking.findMany({
          where: {
            fieldId: Number(fieldId),
            bookingDate: {
              equals: new Date(dateString)
            },
            payment: {
              status: {
                notIn: ['dp_paid', 'paid']
              }
            }
          },
          select: {
            startTime: true,
            endTime: true
          },
          orderBy: {
            startTime: 'asc'
          }
        });
        
        // Get field opening hours
        const field = await prisma.field.findUnique({
          where: { id: Number(fieldId) }
        });
        
        if (!field) {
          return callback({ 
            status: 'error', 
            message: 'Field not found' 
          });
        }
        
        const openingTime = new Date(`${dateString}T06:00:00`);
        const closingTime = new Date(`${dateString}T23:00:00`);
        
        // Calculate available time slots
        const bookedSlots = existingBookings.map(booking => ({
          start: new Date(booking.startTime),
          end: new Date(booking.endTime)
        }));
        
        const availableSlots = calculateAvailableTimeSlots(
          openingTime, 
          closingTime, 
          bookedSlots
        );
        
        callback({ 
          status: 'success', 
          data: { availableSlots } 
        });
      } catch (error) {
        console.error('Get available slots error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to get available time slots' 
        });
      }
    });

    // Create a new booking
    socket.on('create-booking', async (data, callback) => {
      try {
        const { fieldId, bookingDate, startTime, endTime } = data;
        const userId = socket.data.user.id;
        
        if (!fieldId || !bookingDate || !startTime || !endTime) {
          return callback({ 
            status: 'error', 
            message: 'Missing required fields' 
          });
        }
        
        const field = await prisma.field.findUnique({
          where: { id: fieldId },
          include: { branch: true }
        });
    
        if (!field) {
          return callback({ 
            status: 'error', 
            message: 'Field not found' 
          });
        }
    
        const bookingDateTime = new Date(bookingDate);
        const startDateTime = combineDateWithTime(bookingDateTime, startTime);
        const endDateTime = combineDateWithTime(bookingDateTime, endTime);
    
        const isAvailable = await isFieldAvailable(fieldId, bookingDateTime, startDateTime, endDateTime);
        if (!isAvailable) {
          return callback({ 
            status: 'error', 
            message: 'Field is already booked' 
          });
        }
    
        const totalPrice = calculateTotalPrice(
          startDateTime,
          endDateTime,
          Number(field.priceDay),
          Number(field.priceNight)
        );
    
        // Create booking
        const newBooking = await prisma.booking.create({
          data: {
            userId,
            fieldId,
            bookingDate: bookingDateTime,
            startTime: startDateTime,
            endTime: endDateTime,
          },
          include: { 
            field: true, 
            user: { 
              select: { name: true, email: true, phone: true } 
            } 
          }
        });
        
        // Notify all clients in the bookings namespace about the new booking
        namespace.emit('booking-created', { 
          bookingId: newBooking.id,
          fieldId: newBooking.fieldId,
          startTime: newBooking.startTime,
          endTime: newBooking.endTime,
          status: 'pending'
        });
        
        callback({ 
          status: 'success', 
          data: { 
            booking: newBooking,
            totalPrice
          } 
        });
      } catch (error) {
        console.error('Create booking error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to create booking' 
        });
      }
    });

    // Cancel a booking
   // Cancel a booking
socket.on('cancel-booking', async (data, callback) => {
    try {
      const { bookingId } = data;
      const userId = socket.data.user.id;
      
      const booking = await prisma.booking.findUnique({
        where: { id: Number(bookingId) },
        include: { payment: true }
      });
      
      if (!booking) {
        return callback({ 
          status: 'error', 
          message: 'Booking not found' 
        });
      }
      
      if (booking.userId !== userId) {
        return callback({ 
          status: 'error', 
          message: 'Not authorized to cancel this booking' 
        });
      }
      
      // If there's a payment, update its status to failed
      if (booking.payment) {
        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.failed }
        });
      }
      
      // Get the updated booking with payment
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: Number(bookingId) },
        include: { payment: true }
      });
      
      // Notify all clients about the cancellation
      namespace.emit('booking-canceled', { 
        bookingId: Number(bookingId),
        fieldId: booking.fieldId
      });
      
      callback({ 
        status: 'success', 
        data: { booking: updatedBooking } 
      });
    } catch (error) {
      console.error('Cancel booking error:', error);
      callback({ 
        status: 'error', 
        message: 'Failed to cancel booking' 
      });
    }
  });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected from bookings namespace: ${socket.data.user.id}`);
    });
  });
}

// Helper function for calculating available time slots
type TimeSlot = { start: Date; end: Date };

function calculateAvailableTimeSlots(
  openingTime: Date, 
  closingTime: Date, 
  bookedSlots: TimeSlot[]
): TimeSlot[] {
  if (bookedSlots.length === 0) {
    return [{ start: openingTime, end: closingTime }];
  }
  
  const sortedBookings = [...bookedSlots].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );
  
  const availableSlots: TimeSlot[] = [];
  let currentTime = openingTime;
  
  for (const booking of sortedBookings) {
    if (currentTime < booking.start) {
      availableSlots.push({
        start: currentTime,
        end: booking.start
      });
    }
    currentTime = booking.end > currentTime ? booking.end : currentTime;
  }
  
  if (currentTime < closingTime) {
    availableSlots.push({
      start: currentTime,
      end: closingTime
    });
  }
  
  return availableSlots;
}