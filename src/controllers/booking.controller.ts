import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../config/database';
import { CreateBookingDto } from '../dto/booking/create-booking.dto';
import { combineDateWithTime, calculateTotalPrice } from '../utils/date.utils';
import { isFieldAvailable } from '../utils/availability.utils';

export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } }
      }
    });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingDto = new CreateBookingDto();
    Object.assign(bookingDto, req.body);
    
    const errors = await validate(bookingDto);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    
    const { userId, fieldId, bookingDate, startTime, endTime } = bookingDto;

    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (field.status !== 'available') {
      res.status(400).json({ error: 'Field is not available for booking' });
      return;
    }

    // Convert time from "HH:MM" to Date object
    const bookingDateTime = new Date(bookingDate);
    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

    // Validate if endTime is after startTime
    if (startDateTime >= endDateTime) {
      res.status(400).json({ error: 'End time must be after start time' });
      return;
    }

    // Check field availability
    const isAvailable = await isFieldAvailable(fieldId, bookingDateTime, startDateTime, endDateTime);
    
    if (!isAvailable) {
      res.status(400).json({ error: 'Field is already booked for the requested time slot' });
      return;
    }

    // Calculate total price based on hourly rate
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );
    
    console.log(`Total Price: ${totalPrice}`);

    // Save booking to database
    const newBooking = await prisma.booking.create({
      data: {
        userId,
        fieldId,
        bookingDate: bookingDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
        status: 'pending',
        paymentStatus: 'pending',
      },
      include: {
        field: true,
        user: { select: { name: true, email: true } }
      }
    });

    res.status(201).json({
      ...newBooking,
      totalPrice
    });
      
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create booking' });
  }
};

export const updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;
    
    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status, paymentStatus }
    });
    
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update booking' });
  }
};

export const deleteBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.booking.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete booking' });
  }
};