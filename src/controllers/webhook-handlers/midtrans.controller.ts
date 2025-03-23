import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus } from '@prisma/client';
import { emitBookingEvents } from '../../utils/booking/booking.utils';
import { getIO } from '../../config/server/socket';
import { sendPaymentNotification } from '../../socket-handlers/payment.socket';
import { ActivityLogService } from '../../utils/activityLog/activityLog.utils';
import {
  trackFailedBooking,
  resetFailedBookingCounter,
} from '../../middlewares/security.middleware';

// Import the global type definition
declare global {
  var activeLocks: Record<string, boolean>;
}

export const handleMidtransNotification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const notification = req.body;
    console.log('🔔 Midtrans notification received:', notification);

    // Extract data from notification
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;
    const paymentType = notification.payment_type;
    const grossAmount = notification.gross_amount;

    if (!orderId) {
      console.error('❌ Missing order_id in webhook request');
      res.status(400).json({ error: 'Missing order_id' });
      return;
    }

    // Handle test notifications from Midtrans
    if (orderId && orderId.includes('_test_')) {
      console.log('ℹ️ Received test notification from Midtrans:', orderId);
      console.log('✅ Test notification processed successfully');
      res.status(200).json({ message: 'Test notification acknowledged' });
      return;
    }

    // Extract payment ID from order ID
    // Format: PAY-{paymentId}
    let paymentId: number;
    if (orderId.startsWith('PAY-')) {
      // Format: PAY-123-xyz or PAY-123
      const paymentIdStr = orderId.substring(4).split('-')[0];
      paymentId = parseInt(paymentIdStr);
    } else {
      paymentId = parseInt(orderId);
    }

    if (isNaN(paymentId)) {
      console.error('❌ Invalid payment ID format in order_id');
      res.status(400).json({ error: 'Invalid order_id format' });
      return;
    }

    // Use locking mechanism to prevent concurrent updates
    const lockKey = `payment_update_${paymentId}`;

    // Initialize locks if not exists
    if (!global.activeLocks) global.activeLocks = {};

    // Check if payment is already being processed
    if (global.activeLocks[lockKey]) {
      console.log('⚠️ Another update for this payment is already in progress');
      res.status(409).json({ message: 'Update already in progress' });
      return;
    }

    // Set lock
    global.activeLocks[lockKey] = true;

    try {
      // Find the payment in the database
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              field: true,
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      });

      if (!payment) {
        console.error('❌ Payment not found:', paymentId);
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      // Determine new payment status based on transaction status
      let newStatus: PaymentStatus;

      if (
        transactionStatus === 'capture' ||
        transactionStatus === 'settlement'
      ) {
        if (fraudStatus === 'challenge') {
          newStatus = PaymentStatus.pending; // Need manual verification
        } else if (fraudStatus === 'accept' || fraudStatus === null) {
          // Check if it's partial payment
          const fieldPrice = Number(payment.amount);
          const paymentAmount =
            typeof grossAmount === 'string'
              ? parseFloat(grossAmount)
              : Number(grossAmount);

          if (paymentAmount < fieldPrice) {
            newStatus = PaymentStatus.dp_paid; // Partial payment
            console.log(
              `💰 Down payment received: ${paymentAmount} out of ${fieldPrice}`,
            );
          } else {
            newStatus = PaymentStatus.paid; // Full payment
            console.log(`💰 Full payment received: ${paymentAmount}`);
          }

          // Reset failed counter if payment successful
          if (payment.booking.userId) {
            resetFailedBookingCounter(payment.booking.userId);
          }
        } else {
          newStatus = PaymentStatus.failed; // Fraud detected
        }
      } else if (transactionStatus === 'pending') {
        newStatus = PaymentStatus.pending; // Payment pending
      } else if (
        transactionStatus === 'deny' ||
        transactionStatus === 'cancel' ||
        transactionStatus === 'expire' ||
        transactionStatus === 'failure'
      ) {
        newStatus = PaymentStatus.failed; // Payment failed

        // Jika pembayaran gagal, tambahkan ke pelacakan
        if (payment.booking && payment.booking.userId) {
          const clientIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
          await trackFailedBooking(
            payment.booking.userId,
            payment.booking.id,
            clientIP,
          );
        }
      } else if (transactionStatus === 'refund') {
        newStatus = PaymentStatus.refunded; // Payment refunded
      } else {
        newStatus = PaymentStatus.pending; // Default to pending for other statuses
      }

      console.log(
        '🔄 Updating payment status from',
        payment.status,
        'to',
        newStatus,
      );

      // Use transaction to ensure all database operations complete together
      await prisma.$transaction(async (tx) => {
        // Update payment status in the database
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: newStatus,
            // Add transaction ID if available
            ...(notification.transaction_id && {
              transactionId: notification.transaction_id,
            }),
          },
        });

        console.log('✅ Payment status updated:', newStatus);

        // Create notification for the user
        await tx.notification.create({
          data: {
            userId: payment.booking.user.id,
            title: `Status Pembayaran Diperbarui`,
            message: `Status pembayaran untuk booking #${payment.booking.id} sekarang ${newStatus}.`,
            isRead: false,
            type: 'PAYMENT',
            linkId: payment.id.toString(),
          },
        });
      });

      // Create activity log for the payment update
      await ActivityLogService.logPaymentActivity(
        payment.booking.user.id,
        paymentId,
        payment.booking.id,
        newStatus,
        {
          transactionStatus,
          amount: grossAmount,
        },
      );

      // Get complete booking with updated payment for emitting events
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: payment.booking.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          field: { include: { branch: true } },
          payment: true,
        },
      });

      if (updatedBooking) {
        // Emit real-time events via Socket.IO
        emitBookingEvents('payment:updated', {
          booking: updatedBooking,
          oldStatus: payment.status,
          newStatus,
        });

        // Emit to user's personal channel
        getIO()
          .to(`user-${updatedBooking.userId}`)
          .emit('payment:updated', {
            booking: updatedBooking,
            status: newStatus,
            message: `Status pembayaran Anda telah diperbarui menjadi ${newStatus}`,
          });

        // Emit to branch channel
        getIO()
          .to(`branch-${updatedBooking.field.branchId}`)
          .emit('payment:updated', {
            booking: updatedBooking,
            status: newStatus,
          });

        // Send notification using the specialized payment notification handler
        try {
          sendPaymentNotification({
            paymentId: payment.id,
            bookingId: payment.booking.id,
            status: newStatus,
            userId: payment.booking.user.id,
          });
        } catch (socketError) {
          console.error('❌ Socket.IO Error:', socketError);
          // Continue processing even if socket notification fails
        }
      }

      // Verify the update happened correctly
      const verifiedPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      console.log(
        '🔍 Verified payment status after update:',
        verifiedPayment?.status,
      );

      res.status(200).json({
        success: true,
        message: 'Payment status updated successfully',
        paymentId,
        paymentStatus: newStatus,
      });
    } finally {
      // Always release the lock
      delete global.activeLocks[lockKey];
    }
  } catch (error) {
    console.error('❌ Error processing Midtrans notification:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
