import { Request, Response } from 'express';
import prisma from '../../config/database';
import { PaymentStatus } from '@prisma/client';
import { getIO } from '../../config/socket';
import { ActivityLogService } from '../../utils/activityLog.utils';

// Import the global type definition
declare global {
  var activeLocks: Record<string, boolean>;
}

export const handleMidtransNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("✅ Midtrans Webhook Received:", req.body);
    const { order_id, transaction_status, gross_amount } = req.body;
    
    if (!order_id) {
      console.error("❌ Missing order_id in webhook request");
      res.status(400).json({ error: 'Missing order_id' });
      return;
    }

    console.log(`ℹ️ Processing order: ${order_id}, status: ${transaction_status}`);

    // Handle test notifications from Midtrans
    if (order_id.includes('_test_')) {
      console.log("ℹ️ Received test notification from Midtrans:", order_id);
      console.log("✅ Test notification processed successfully");
      res.status(200).json({ message: 'Test notification acknowledged' });
      return;
    }

    // Extract payment ID from order_id with improved error handling
    let paymentIdStr;
    if (order_id.startsWith('PAY-')) {
      // Format: PAY-123-xyz or PAY-123
      paymentIdStr = order_id.substring(4).split('-')[0];
    } else {
      paymentIdStr = order_id;
    }

    const paymentId = parseInt(paymentIdStr);

    if (isNaN(paymentId)) {
      console.error("❌ Invalid payment ID format:", paymentIdStr);
      res.status(400).json({ error: 'Invalid payment ID' });
      return;
    }

    // Use locking mechanism to prevent concurrent updates
    const lockKey = `payment_update_${paymentId}`;
    if (global.activeLocks && global.activeLocks[lockKey]) {
      console.log("⚠️ Another update is in progress for this payment");
      res.status(409).json({ message: 'Update already in progress' });
      return;
    }

    // Initialize locks if not exists
    if (!global.activeLocks) global.activeLocks = {};
    global.activeLocks[lockKey] = true;

    try {
      // Get payment record with booking details
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
        console.error("❌ Payment not found for ID:", paymentId);
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      // Determine payment status based on transaction_status
      let paymentStatus: PaymentStatus = PaymentStatus.pending;

      if (transaction_status === 'capture' || transaction_status === 'settlement') {
        // Convert gross_amount to number explicitly
        const fieldPrice = Number(payment.booking.field.priceNight);
        const paymentAmount = typeof gross_amount === 'string' ? 
          parseFloat(gross_amount) : Number(gross_amount);

        // Check if payment is full or down payment
        if (paymentAmount < fieldPrice) {
          paymentStatus = PaymentStatus.dp_paid;
          console.log(`💰 Down payment received: ${paymentAmount} out of ${fieldPrice}`);
        } else {
          paymentStatus = PaymentStatus.paid;
          console.log(`💰 Full payment received: ${paymentAmount}`);
        }
      } else if (transaction_status === 'pending') {
        paymentStatus = PaymentStatus.pending;
      } else if (['expire', 'cancel', 'deny', 'failure'].includes(transaction_status)) {
        paymentStatus = PaymentStatus.failed;
      }

      // Use transaction to ensure all database operations complete together
      await prisma.$transaction(async (tx) => {
        console.log("🔄 Starting transaction for payment update");
        
        // Update payment status in database
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { status: paymentStatus },
        });
        
        console.log("✅ Payment updated in transaction:", updatedPayment);
        
        // Create notification for the user
        await tx.notification.create({
          data: {
            userId: payment.booking.user.id,
            title: `Payment Status Updated`,
            message: `Your payment for booking #${payment.booking.id} status is now ${paymentStatus}.`,
            isRead: false,
            type: 'PAYMENT',
            linkId: payment.id.toString(),
          },
        });
      });
      
      // Create activity log separately to avoid duplicating service logic
      await ActivityLogService.logPaymentActivity(
        payment.booking.user.id,
        paymentId,
        payment.booking.id,
        paymentStatus,
        {
          transactionStatus: transaction_status,
          amount: gross_amount
        }
      );
      
      // Verify the update happened correctly
      const verifiedPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      console.log("🔍 Verified payment status after update:", verifiedPayment?.status);
      
      // Get IO instance
      const io = getIO();
      
      // Send real-time notification
      try {
        if (io) {
          const userRoomId = `user_${payment.booking.user.id}`;
          
          // Emit to user's specific room
          io.to(userRoomId).emit('payment_update', {
            paymentId: payment.id,
            bookingId: payment.booking.id,
            status: paymentStatus,
            message: `Your payment status is now ${paymentStatus}`,
          });
          
          // Also emit to the payments namespace for any admin dashboards
          io.of('/payments').emit('status_change', {
            paymentId: payment.id,
            bookingId: payment.booking.id,
            status: paymentStatus,
            userId: payment.booking.user.id
          });
          
          console.log(`📢 Sent real-time updates to ${userRoomId} and /payments namespace`);
        } else {
          console.warn("⚠️ Socket.IO not initialized, skipping real-time notification");
        }
      } catch (socketError) {
        console.error("❌ Socket.IO Error:", socketError);
        // Continue processing even if socket notification fails
      }
      
      console.log(`✅ Payment ${paymentId} updated to ${paymentStatus}`);

      res.status(200).json({ 
        message: 'Payment status updated successfully', 
        paymentId,
        paymentStatus
      });
    } finally {
      // Always release the lock
      delete global.activeLocks[lockKey];
    }
  } catch (error) {
    console.error('❌ Midtrans Webhook Error:', error);
    res.status(500).json({ error: 'Failed to process Midtrans webhook' });
  }
};