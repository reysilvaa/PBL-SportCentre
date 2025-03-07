import { Request, Response } from 'express';
import prisma from '../../config/database';
import { isFieldAvailable } from '../../utils/availability.utils';

export const checkFieldAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fieldId, bookingDate, startTime, endTime } = req.query;
    
    if (!fieldId || !bookingDate || !startTime || !endTime) {
      res.status(400).json({ error: 'Missing required query parameters' });
      return;
    }
    
    const start = new Date(startTime as string);
    const end = new Date(endTime as string);
    const date = new Date(bookingDate as string);
    
    const isAvailable = await isFieldAvailable(
      Number(fieldId), 
      date, 
      start, 
      end
    );
    
    res.json({ isAvailable });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to check field availability' });
  }
};

export const getAvailableTimeSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fieldId, date } = req.query;
    
    if (!fieldId || !date) {
      res.status(400).json({ error: 'Field ID and date are required' });
      return;
    }
    
    const bookingDate = new Date(date as string);
    const dateString = bookingDate.toISOString().split('T')[0];
    
    // Get all bookings for the field on the specified date
    const existingBookings = await prisma.booking.findMany({
      where: {
        fieldId: Number(fieldId),
        bookingDate: {
          equals: new Date(dateString)
        },
        payment:{
        status: {
          notIn: ['paid', 'dp_paid']
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
    
    // Get field opening hours (assuming 6:00 to 23:00 as default)
    // In a real application, you would get this from field configuration
    const field = await prisma.field.findUnique({
      where: { id: Number(fieldId) }
    });
    
    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
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
    
    res.json({ availableSlots });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to get available time slots' });
  }
};

type TimeSlot = { start: Date; end: Date };

const calculateAvailableTimeSlots = (
  openingTime: Date, 
  closingTime: Date, 
  bookedSlots: TimeSlot[]
): TimeSlot[] => {
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
};