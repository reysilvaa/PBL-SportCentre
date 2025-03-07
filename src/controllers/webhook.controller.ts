import { Request, Response } from 'express';
import prisma from '../config/database';
import { getIO } from '../config/socket';
import { PaymentStatus } from '@prisma/client';

export const handleMidtransNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("✅ Midtrans Webhook Received:", req.body);

    const { order_id, transaction_status, gross_amount } = req.body;
    if (!order_id) {
      console.error("❌ Missing order_id in webhook request");
      res.status(400).json({ error: 'Missing order_id' });
      return;
    }

    // Extract payment ID from order_id (removes the PAY- prefix)
    const paymentIdStr = order_id.startsWith('PAY-') ? order_id.substring(4).split('-')[0] : order_id;
    const paymentId = parseInt(paymentIdStr);

    if (isNaN(paymentId)) {
      console.error("❌ Invalid payment ID format:", paymentIdStr);
      res.status(400).json({ error: 'Invalid payment ID' });
      return;
    }

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
      const fieldPrice = payment.booking.field.priceNight;
      const paymentAmount = Number(gross_amount);

      // Check if payment is full or down payment
      if (paymentAmount < Number(fieldPrice)) {
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

    // Update payment status in database
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: paymentStatus },
    });

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: payment.booking.user.id,
        title: `Payment Status Updated`,
        message: `Your payment for booking #${payment.booking.id} status is now ${paymentStatus}.`,
        isRead: false,
        type: 'PAYMENT',
        linkId: payment.id.toString(),
      },
    });
    
    // Send real-time notification if Socket.IO is available
    try {
      const io = getIO();
      if (io) {
        const roomId = `user_${payment.booking.user.id}`;
        io.to(roomId).emit('payment_update', {
          paymentId: payment.id,
          bookingId: payment.booking.id,
          status: paymentStatus,
          message: `Your payment status is now ${paymentStatus}`,
        });
        console.log(`📢 Sent real-time update to ${roomId}`);
      } else {
        console.warn("⚠️ Socket.IO not initialized, skipping real-time notification");
      }
    } catch (ioError) {
      console.error("❌ Socket.IO Error:", ioError);
    }
    
    console.log(`✅ Payment ${paymentId} updated to ${paymentStatus}`);

    res.status(200).json({ 
      message: 'Payment status updated successfully', 
      paymentId,
      paymentStatus
    });
  } catch (error) {
    console.error('❌ Midtrans Webhook Error:', error);
    res.status(500).json({ error: 'Failed to process Midtrans webhook' });
  }
};
