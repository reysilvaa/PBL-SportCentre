import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../config/database';
import midtrans from '../config/midtrans';
import { CreateBookingDto } from '../dto/booking/create-booking.dto';
import { combineDateWithTime, calculateTotalPrice } from '../utils/date.utils';
import { isFieldAvailable } from '../utils/availability.utils';

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
      where: { id: fieldId },
      include: { branch: true }
    });

    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const bookingDateTime = new Date(bookingDate);
    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

    const isAvailable = await isFieldAvailable(fieldId, bookingDateTime, startDateTime, endDateTime);
    if (!isAvailable) {
      res.status(400).json({ error: 'Field is already booked' });
      return;
    }

    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );

    // Create booking first
    const newBooking = await prisma.booking.create({
      data: {
        userId,
        fieldId,
        bookingDate: bookingDateTime,
        startTime: startDateTime,
        endTime: endDateTime,
      },
      include: { field: true, user: { select: { name: true, email: true, phone: true } } }
    });

    // Create payment with relation to booking
    const payment = await prisma.payment.create({
      data: {
        bookingId: newBooking.id,
        userId,
        amount: totalPrice,
        paymentMethod: 'midtrans',
        status: 'pending'
      }
    });

    const transaction = await midtrans.createTransaction({
      transaction_details: {
        order_id: `PAY-${payment.id}`,
        gross_amount: totalPrice
      },
      customer_details: {
        first_name: user.name,
        email: user.email,
        phone: user.phone
      },
      item_details: [
        {
          id: field.id.toString(),
          name: `${field.branch.name} - ${field.name}`,
          price: totalPrice,
          quantity: 1
        }
      ]
    });

    if (!transaction.redirect_url) {
      console.error("Midtrans failed to generate redirect URL");
      res.status(500).json({ error: "Failed to initiate payment" });
      return;
    }

    console.log(`Booking created: ID ${newBooking.id}, User ${userId}`);
    console.log(`Payment created: ID ${payment.id}, Amount ${totalPrice}`);
    console.log("Midtrans Transaction Response:", transaction);

    res.status(201).json({
      message: 'Booking created successfully',
      booking: { ...newBooking, totalPrice },
      payment: { id: payment.id, status: payment.status },
      redirect_url: transaction.redirect_url
    });
      
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(400).json({ error: 'Failed to create booking' });
  }
};

export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } },
        payment: true  // Changed from Payments to payment (singular)
      }
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
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } },
        payment: true  // Changed from Payments to payment (singular)
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

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const bookings = await prisma.booking.findMany({
      where: { userId: parseInt(userId) },
      include: {
        field: { include: { branch: true } },
        payment: true  // Changed from Payments to payment (singular)
      },
      orderBy: { bookingDate: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { payment: true }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // Only update the payment status if there's a payment and a new status provided
    if (booking.payment && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { status: paymentStatus }
      });
    }
    
    // Return the updated booking
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { payment: true }
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
    
    // First check if booking exists and has a payment
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { payment: true }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // If there's a payment, delete it first
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