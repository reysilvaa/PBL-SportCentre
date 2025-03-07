import { Request, Response } from 'express';
import prisma from '../../config/database';
import { PaymentStatus } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

// Helper function to get status message based on payment status
const getStatusMessage = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.paid:
      return 'has been completed successfully';
    case PaymentStatus.dp_paid:
      return 'down payment has been received';
    case PaymentStatus.pending:
      return 'is awaiting confirmation';
    case PaymentStatus.failed:
      return 'has failed';
    default:
      return 'status has been updated';
  }
};

export const createMidtransWebhookHandler = (io: SocketIOServer) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("Midtrans Webhook Received:", req.body);
      const { order_id, transaction_status, gross_amount, signature_key } = req.body;
      
      // Extract payment ID from order_id
      let paymentId: number | null = null;
      if (order_id.startsWith('PAY-')) {
        const idPart = order_id.substring(4).split('-')[0];
        paymentId = parseInt(idPart);
      }
      if (!paymentId || isNaN(paymentId)) {
        console.error("Invalid Payment ID:", order_id);
        res.status(400).json({ error: 'Invalid payment ID' });
        return;
      }
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: { 
            include: { 
              field: true,
              user: { select: { id: true, name: true, email: true } }
            }
          }
        },
      });
      if (!payment) {
        console.error("Payment Not Found:", paymentId);
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      let paymentStatus: PaymentStatus = PaymentStatus.pending;
      if (transaction_status === 'capture' || transaction_status === 'settlement') {
        const fieldPrice = payment.booking.field.priceNight;
        const paymentAmount = Number(gross_amount);
        if (paymentAmount < Number(fieldPrice)) {
          paymentStatus = PaymentStatus.dp_paid;
          console.log(`Down payment received: ${paymentAmount} out of ${fieldPrice}`);
        } else {
          paymentStatus = PaymentStatus.paid;
          console.log(`Full payment received: ${paymentAmount}`);
        }
      } else if (transaction_status === 'pending') {
        paymentStatus = PaymentStatus.pending;
      } else if (['expire', 'cancel', 'deny', 'failure'].includes(transaction_status)) {
        paymentStatus = PaymentStatus.failed;
      }
      // Update payment record
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: { status: paymentStatus },
      });
      
      // Create notification for the user
      await prisma.notification.create({
        data: {
          userId: payment.booking.userId,
          title: `Payment ${getStatusMessage(paymentStatus)}`,
          message: `Your payment for booking #${payment.booking.id} ${getStatusMessage(paymentStatus)}.`,
          isRead: false,
          type: 'PAYMENT',
          linkId: payment.id.toString(),
        },
      });
      
      // Emit socket event to notify client
      const roomId = `user_${payment.booking.userId}`;
      io.to(roomId).emit('payment_update', {
        paymentId: payment.id,
        bookingId: payment.booking.id,
        status: paymentStatus,
        message: `Your payment ${getStatusMessage(paymentStatus)}`,
      });
      
      // Update booking status if payment is completed
      if (paymentStatus === PaymentStatus.paid) {
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { },
        });
        
        // Emit booking confirmation event
        io.to(roomId).emit('booking_confirmed', {
          bookingId: payment.bookingId,
          fieldName: payment.booking.field.name,
          date: payment.booking.bookingDate,
        });
      }
      
      // Send success response
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        paymentId: payment.id,
        status: paymentStatus
      });
      
    } catch (error: unknown) {
        console.error("Error processing Midtrans webhook:", error);
        
        // Use type guard to safely access error properties
        if (error instanceof Error) {
          res.status(500).json({ error: 'Internal server error', details: error.message });
        } else {
          // Fallback for non-Error objects
          res.status(500).json({ error: 'Internal server error', details: 'Unknown error occurred' });
        }
      }
  };
};