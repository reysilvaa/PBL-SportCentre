import { Request, Response } from 'express';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';
import midtrans from '../config/midtrans';

// Di midtrans.controller.ts
export const handleMidtransNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Midtrans Webhook Received:", req.body);

    const { order_id, transaction_status, gross_amount, signature_key } = req.body;
    
    // Extract payment ID from order_id (removes the PAY- prefix if present)
    const paymentIdStr = order_id.startsWith('PAY-') ? order_id.substring(4).split('-')[0] : order_id;
    const paymentId = parseInt(paymentIdStr);

    if (!paymentId || isNaN(paymentId)) {
      console.error("Invalid Payment ID:", order_id);
      res.status(400).json({ error: 'Invalid payment ID' });
      return;
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: { include: { field: true } }
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
    await prisma.payment.update({
      where: { id: paymentId },
      data: { 
        status: paymentStatus,
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId: payment.booking.userId,
        action: `Payment ${paymentStatus} for booking ${payment.booking.id}`,
        details: JSON.stringify({
          bookingId: payment.booking.id,
          paymentId: payment.id,
          transactionStatus: transaction_status,
          amount: gross_amount
        })
      }
    });
    
    console.log(`Payment ${paymentId} updated to ${paymentStatus}`);

    res.status(200).json({ 
      message: 'Payment status updated successfully', 
      paymentId,
      paymentStatus
    });
  } catch (error) {
    console.error('Midtrans Webhook Error:', error);
    res.status(500).json({ error: 'Failed to process Midtrans webhook' });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const paymentId = parseInt(id);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: { 
          include: { 
            field: { include: { branch: true } },
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      createdAt: payment.createdAt,
      booking: {
        id: payment.booking.id,
        field: {
          name: payment.booking.field.name,
          branch: payment.booking.field.branch.name
        },
        user: payment.booking.user
      }
    });
  } catch (error) {
    console.error('Get Payment Status Error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};