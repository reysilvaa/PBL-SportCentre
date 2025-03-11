import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import prisma from '../../config/database';
import midtrans from '../../config/midtrans';
import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
import { combineDateWithTime, calculateTotalPrice } from '../../utils/bookingDate.utils';
import { isFieldAvailable } from '../../utils/availability.utils';
import { startBookingCleanupJob } from '../../utils/bookingCleanup.utils';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

// Define interface for Request with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

// Inisialisasi cron job pembersihan booking pada saat server dimulai
const bookingCleanupJob = startBookingCleanupJob();

/**
 * User Booking Controller
 * Handles operations that regular users can perform
 */

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

    // Create payment record without expiry date initially
    // We'll update this after getting Midtrans response
    const payment = await prisma.payment.create({ 
      data: { 
        bookingId: newBooking.id, 
        userId: userIdInt, 
        amount: totalPrice, 
        status: 'pending' as PaymentStatus,
        paymentMethod: 'midtrans' as PaymentMethod,
        // No expiresDate set yet - will be updated after Midtrans response
      } 
    });

    console.log("💳 Payment created:", payment);

    // Define the expiry time in Midtrans (5 minutes)
    const expiryMinutes = 5;
    
    // Create Midtrans transaction with expiry
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
      }],
      expiry: {
        unit: "minutes",
        duration: expiryMinutes
      }
    });

    console.log("🔗 Midtrans transaction:", transaction);

    // Extract expiry time from Midtrans response and update payment record
    // Note: You need to extract this information from the Midtrans response
    // The exact format depends on what Midtrans returns
    if (transaction.expiry_time) {
      // If Midtrans returns expiry_time directly
      const expiryDate = new Date(transaction.expiry_time);
      
      // Update the payment record with the expiry date from Midtrans
      await prisma.payment.update({
        where: { id: payment.id },
        data: { expiresDate: expiryDate }
      });
      
      console.log("⏱️ Payment expires at (from Midtrans):", expiryDate);
    } else {
      // If Midtrans doesn't return expiry_time directly, calculate it
      // based on current time + duration from Midtrans
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
      
      // Update the payment record with the calculated expiry date
      await prisma.payment.update({
        where: { id: payment.id },
        data: { expiresDate: expiryDate }
      });
      
      console.log("⏱️ Payment expires at (calculated):", expiryDate);
    }

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

// Additional function for webhook handler to update payment expiry
export const midtransWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = req.body;
    
    console.log("📩 Midtrans notification:", notification);
    
    // Extract order ID from Midtrans notification
    const orderId = notification.order_id;
    
    // Extract payment ID from order ID (assuming format PAY-{id})
    const paymentId = parseInt(orderId.split('-')[1]);
    
    if (!paymentId) {
      res.status(400).json({ error: 'Invalid order ID format' });
      return;
    }
    
    // Get the payment record
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });
    
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    
    // Update payment status based on notification
    const transactionStatus = notification.transaction_status;
    let newPaymentStatus: PaymentStatus = 'pending' as PaymentStatus;
    
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      newPaymentStatus = 'paid' as PaymentStatus;
    } else if (transactionStatus === 'pending') {
      // Payment is still pending, but we need to update the expiry
      // Start the 5-minute countdown now
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 5);
      
      await prisma.payment.update({
        where: { id: paymentId },
        data: { 
          status: 'pending' as PaymentStatus,
          expiresDate: expiryDate
        }
      });
      
      console.log(`⏱️ Updated payment #${paymentId} expiry to ${expiryDate} after Midtrans notification`);
      
      res.status(200).json({ status: 'ok' });
      return;
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || 
              transactionStatus === 'expire' || transactionStatus === 'failure') {
      newPaymentStatus = 'failed' as PaymentStatus;
    }
    
    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: newPaymentStatus }
    });
    
    console.log(`💳 Updated payment #${paymentId} status to ${newPaymentStatus}`);
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error("❌ Error in midtransWebhook:", error);
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
        payment: true // Based on the schema this is a one-to-one relation
      },
      orderBy: { bookingDate: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBookingById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Using the authenticated request interface
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const booking = await prisma.booking.findUnique({
      where: { 
        id: parseInt(id)
      },
      include: {
        field: { include: { branch: true } },
        payment: true // Based on the schema this is a one-to-one relation
      }
    });
    
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // Ensure users can only view their own bookings
    if (booking.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};