import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../config/database';
import { CreateBookingDto } from '../dto/booking/create-booking.dto';

export const getBookings = async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        field: {
          include: {
            branch: true
          }
        }
      }
    });
    res.json(bookings);
  } catch (error) {
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
    const newBooking = await prisma.booking.create({
      data: {
        userId,
        fieldId,
        bookingDate,
        startTime,
        endTime,
        status: 'pending',
        paymentStatus: 'pending'
      }
    });
    
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create booking' });
  }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;
    const updatedBooking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: {
        status,
        paymentStatus
      }
    });
    res.json(updatedBooking);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update booking' });
  }
  return;
};

export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.booking.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete booking' });
  }
};