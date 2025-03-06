import { Server, Socket } from 'socket.io';
import prisma from '../../config/database';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
import { validate } from 'class-validator';

// Helper function to check field availability
const isFieldAvailable = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  const dateString = bookingDate.toISOString().split('T')[0];

  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: { equals: new Date(dateString) },
      status: { notIn: ['canceled', 'refunded'] },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } }
      ]
    }
  });

  return overlappingBookings.length === 0;
};

export const initBookingSocket = (io: Server) => {
  const bookingNamespace = io.of('/booking');

  bookingNamespace.on('connection', (socket: Socket) => {
    console.log('Client connected to booking namespace');

    socket.on('checkAvailability', async (data: { fieldId: number, bookingDate: string, startTime: string, endTime: string }) => {
      try {
        const { fieldId, bookingDate, startTime, endTime } = data;
        const isAvailable = await isFieldAvailable(
          fieldId,
          new Date(bookingDate),
          new Date(startTime),
          new Date(endTime)
        );
        socket.emit('availabilityResult', { isAvailable });
      } catch (error) {
        socket.emit('error', {
          type: 'availability',
          error: 'Failed to check field availability',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    socket.on('createBooking', async (data: CreateBookingDto) => {
      try {
        const dto = new CreateBookingDto();
        Object.assign(dto, data);

        const errors = await validate(dto);
        if (errors.length > 0) {
          return socket.emit('error', { type: 'validation', error: 'Validation failed', details: errors });
        }

        const { userId, fieldId, bookingDate, startTime, endTime } = dto;
        const isAvailable = await isFieldAvailable(fieldId, new Date(bookingDate), new Date(startTime), new Date(endTime));

        if (!isAvailable) {
          return socket.emit('error', { type: 'conflict', error: 'Field is already booked for the requested time slot' });
        }

        const newBooking = await prisma.booking.create({
          data: { userId, fieldId, bookingDate: new Date(bookingDate), startTime: new Date(startTime), endTime: new Date(endTime), status: 'pending', paymentStatus: 'pending' },
          include: { field: true, user: { select: { name: true, email: true } } }
        });

        bookingNamespace.emit('newBooking', newBooking);
        socket.emit('bookingCreated', newBooking);
      } catch (error) {
        socket.emit('error', { type: 'creation', error: 'Failed to create booking', details: error instanceof Error ? error.message : String(error) });
      }
    });

    socket.on('cancelBooking', async (data: { id: number, userId: number, reason: string }) => {
      try {
        const { id, userId, reason } = data;
        const cancelledBooking = await prisma.booking.update({ where: { id }, data: { status: 'canceled' } });

        bookingNamespace.emit('bookingCancelled', cancelledBooking);
        socket.emit('cancellationConfirmed', cancelledBooking);
      } catch (error) {
        socket.emit('error', { type: 'cancellation', error: 'Failed to cancel booking', details: error instanceof Error ? error.message : String(error) });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected from booking namespace');
    });
  });
};
