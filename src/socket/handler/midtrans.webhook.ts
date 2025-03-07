import { Request, Response } from 'express';
import prisma from '../../config/database';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
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

// Map Midtrans payment types to our PaymentMethod enum
const mapPaymentMethod = (midtransPaymentType: string): PaymentMethod => {
  // Convert to lowercase for case-insensitive mapping
  const paymentType = midtransPaymentType?.toLowerCase();
  
  if (paymentType?.includes('credit_card') || paymentType?.includes('credit')) {
    return PaymentMethod.credit_card;
  } else if (paymentType?.includes('gopay') || paymentType?.includes('dana') || 
             paymentType?.includes('ovo') || paymentType?.includes('shopeepay')) {
    return PaymentMethod.ewallet;
  } else if (paymentType?.includes('bank_transfer') || paymentType?.includes('transfer')) {
    return PaymentMethod.transfer;
  } else {
    // Default to midtrans for any other payment type
    return PaymentMethod.midtrans;
  }
};

export const createMidtransWebhookHandler = (io: SocketIOServer) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("Midtrans Webhook Received:", req.body);

      const { 
        order_id, 
        transaction_status, 
        fraud_status, 
        gross_amount, 
        signature_key,
        payment_type
      } = req.body;
      
      // Extract payment ID from order_id with improved parsing
      let paymentId: number | null = null;
      
      if (order_id) {
        if (order_id.startsWith('PAY-')) {
          const idPart = order_id.substring(4).split('-')[0];
          paymentId = parseInt(idPart);
        } else {
          // Try to parse the order_id directly as a number
          paymentId = parseInt(order_id);
        }
      }

      if (!paymentId || isNaN(paymentId)) {
        console.error("Invalid Payment ID:", order_id);
        res.status(400).json({ error: 'Invalid payment ID format', order_id });
        return;
      }

      // Find payment with related booking and user data
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: { 
            include: { 
              field: true,
              user: true
            }
          }
        },
      });

      if (!payment) {
        console.error("Payment Not Found:", paymentId);
        res.status(404).json({ error: 'Payment not found', paymentId });
        return;
      }

      // Determine appropriate payment status based on Midtrans response
      let paymentStatus: PaymentStatus = PaymentStatus.pending;
      
      // Convert Midtrans payment_type to our PaymentMethod enum
      const mappedPaymentMethod = mapPaymentMethod(payment_type);

      // Process transaction status from Midtrans
      if (['capture', 'settlement'].includes(transaction_status)) {
        // Check for fraud status if present
        if (fraud_status === 'challenge') {
          paymentStatus = PaymentStatus.pending;
        } else {
          const fieldPrice = payment.booking.field.priceNight;
          const paymentAmount = Number(gross_amount);

          // Handle partial payment (down payment) vs full payment
          if (paymentAmount < Number(fieldPrice)) {
            paymentStatus = PaymentStatus.dp_paid;
          } else {
            paymentStatus = PaymentStatus.paid;
          }
        }
      } else if (transaction_status === 'pending') {
        paymentStatus = PaymentStatus.pending;
      } else if (['expire', 'cancel', 'deny', 'failure'].includes(transaction_status)) {
        paymentStatus = PaymentStatus.failed;
      }

      // Update booking status based on payment status
      let bookingStatus: string;
      
      switch (paymentStatus) {
        case PaymentStatus.paid:
          bookingStatus = FieldStatus.booked;
          break;
        case PaymentStatus.dp_paid:
          bookingStatus = FieldStatus.booked;
          break;
        case PaymentStatus.failed:
          bookingStatus = FieldStatus.available;
          break;
        default:
          // For pending status, keep the current status
          bookingStatus = payment.booking.field.status;
      }

      // Database transaction to ensure all updates happen atomically
      await prisma.$transaction([
        // Update payment record
        prisma.payment.update({
          where: { id: paymentId },
          data: { 
            status: paymentStatus,
            paymentMethod: mappedPaymentMethod,
          },
        }),

        // Update field status
        prisma.field.update({
          where: { id: payment.booking.fieldId },
          data: { 
            status: bookingStatus as FieldStatus,
          },
        }),

        // Create activity log
        prisma.activityLog.create({
          data: {
            userId: payment.booking.userId,
            action: `Payment ${paymentStatus} for booking ${payment.booking.id}`,
            details: JSON.stringify({
              bookingId: payment.booking.id,
              paymentId: payment.id,
              transactionStatus: transaction_status,
              fraudStatus: fraud_status,
              amount: gross_amount,
              paymentMethod: payment_type
            })
          }
        }),

        // Create notification for the user
        prisma.notification.create({
          data: {
            userId: payment.booking.userId,
            title: `Payment ${getStatusMessage(paymentStatus)}`,
            message: `Your payment for booking #${payment.booking.id} ${getStatusMessage(paymentStatus)}.`,
            isRead: false,
            type: 'PAYMENT',
            linkId: payment.id.toString(),
          },
        })
      ]);
      
      // Emit socket events to notify client
      if (io) {
        const roomId = `user_${payment.booking.userId}`;
        
        // Emit payment update
        io.to(roomId).emit('payment_update', {
          paymentId: payment.id,
          bookingId: payment.booking.id,
          status: paymentStatus,
          message: `Your payment ${getStatusMessage(paymentStatus)}`,
          details: {
            transactionStatus: transaction_status,
            paymentMethod: payment_type,
            amount: gross_amount
          }
        });
        
        // Emit booking confirmation if payment is completed
        if (paymentStatus === PaymentStatus.paid || paymentStatus === PaymentStatus.dp_paid) {
          io.to(roomId).emit('booking_confirmed', {
            bookingId: payment.booking.id,
            fieldName: payment.booking.field.name,
            date: payment.booking.bookingDate,
            paymentStatus: paymentStatus
          });
        }
        
        // Also emit to notification namespace if it exists
        try {
          const notificationNamespace = io.of('/notifications');
          if (notificationNamespace) {
            notificationNamespace.to(roomId).emit('new_notification', {
              title: `Payment ${getStatusMessage(paymentStatus)}`,
              message: `Your payment for booking #${payment.booking.id} ${getStatusMessage(paymentStatus)}.`,
              type: 'PAYMENT',
              linkId: payment.id.toString()
            });
          }
        } catch (err) {
          console.log('Error emitting to notification namespace:', err);
        }
      }
      
      console.log(`Payment ${paymentId} status updated to ${paymentStatus}`);
      console.log(`Field ${payment.booking.fieldId} status updated to ${bookingStatus}`);

      // Always respond with 200 to acknowledge receipt (Midtrans requirement)
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        paymentId,
        status: paymentStatus,
        fieldStatus: bookingStatus
      });
      
    } catch (error: unknown) {
      console.error("Error processing Midtrans webhook:", error);
      
      // Always respond with 200 to Midtrans even on error, but include error details
      // This prevents Midtrans from retrying the webhook repeatedly
      res.status(200).json({ 
        success: false, 
        message: 'Error encountered but webhook acknowledged',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
};

// Import FieldStatus for type safety
import { FieldStatus } from '@prisma/client';