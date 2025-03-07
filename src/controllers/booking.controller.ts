import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import prisma from '../config/database';
import midtrans from '../config/midtrans';
import { CreateBookingDto } from '../dto/booking/create-booking.dto';
import { combineDateWithTime, calculateTotalPrice } from '../utils/date.utils';
import { isFieldAvailable } from '../utils/availability.utils';

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("📥 Request body:", req.body);

    // Transform request body to DTO object
    const bookingDto = plainToClass(CreateBookingDto, req.body);
    
    // Validate DTO
    const validationErrors = await validate(bookingDto);
    if (validationErrors.length > 0) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors.map(err => ({
          property: err.property,
          constraints: err.constraints
        }))
      });
      return;
    }

    const { userId, fieldId, bookingDate, startTime, endTime } = bookingDto;

    // Convert userId and fieldId to integers
    const userIdInt = parseInt(userId.toString());
    const fieldIdInt = parseInt(fieldId.toString());

    // Convert strings to Date objects
    const bookingDateTime = new Date(bookingDate);
    console.log("📆 Booking Date:", bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);
    console.log("⏰ Start & End Time:", startDateTime, endDateTime);

    // Check field availability
    const isAvailable = await isFieldAvailable(fieldIdInt, bookingDateTime, startDateTime, endDateTime);
    console.log("🏟️ Field available:", isAvailable);

    if (!isAvailable) {
      res.status(400).json({ error: 'Field is already booked' });
      return;
    }

    // Get field details for pricing
    const field = await prisma.field.findUnique({ 
      where: { id: fieldIdInt }, 
      include: { branch: true } 
    });

    console.log("📜 Field details:", field);

    if (!field) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userIdInt },
      select: { name: true, email: true, phone: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Calculate price based on booking time
    console.log("💰 Field price (Day/Night):", field.priceDay, field.priceNight);
    const totalPrice = calculateTotalPrice(
      startDateTime, 
      endDateTime, 
      Number(field.priceDay), 
      Number(field.priceNight)
    );
    console.log("💵 Total price:", totalPrice);

    // Create booking record
    const newBooking = await prisma.booking.create({
      data: { 
        userId: userIdInt, 
        fieldId: fieldIdInt, 
        bookingDate: bookingDateTime, 
        startTime: startDateTime, 
        endTime: endDateTime 
      }
    });

    console.log("✅ Booking created:", newBooking);

    // Create payment record
    const payment = await prisma.payment.create({ 
      data: { 
        bookingId: newBooking.id, 
        userId: userIdInt, 
        amount: totalPrice, 
        status: 'pending', 
        paymentMethod: 'midtrans' 
      } 
    });

    console.log("💳 Payment created:", payment);

    // Create Midtrans transaction
    const transaction = await midtrans.createTransaction({
      transaction_details: { 
        order_id: `PAY-${payment.id}`, 
        gross_amount: totalPrice 
      },
      customer_details: {
        first_name: user.name || 'Customer',
        email: user.email || 'customer@example.com',
        phone: user.phone || '08123456789'
      },
      item_details: [{
        id: field.id.toString(),
        name: `${field.branch.name} - ${field.name}`,
        price: totalPrice,
        quantity: 1
      }]
    });

    console.log("🔗 Midtrans transaction:", transaction);

    // Return data with redirect URL
    res.status(201).json({ 
      booking: newBooking, 
      payment, 
      redirect_url: transaction.redirect_url 
    });
  } catch (error) {
    console.error("❌ Error in createBooking:", error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
};

export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        field: { include: { branch: true } },
        payment: true
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

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const bookings = await prisma.booking.findMany({
      where: { userId: parseInt(userId) },
      include: {
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