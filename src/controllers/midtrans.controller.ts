import { Request, Response } from 'express';
import prisma from '../config/database';
import midtrans from '../config/midtrans';
import { PaymentStatus } from '@prisma/client';

export const createMidtransTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, userId, amount } = req.body;

    if (!bookingId || !userId || !amount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId }, 
      select: { name: true, email: true } 
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newPayment = await prisma.payment.create({
      data: { bookingId, userId, amount, paymentMethod: 'midtrans', status: 'pending' }
    });

    const transaction = await midtrans.createTransaction({
      transaction_details: { order_id: newPayment.id.toString(), gross_amount: amount },
      customer_details: { first_name: user.name, email: user.email }
    });

    res.status(201).json({
      message: 'Transaction created',
      payment: newPayment,
      redirect_url: transaction.redirect_url
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

export const midtransWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order_id, transaction_status } = req.body;
    const paymentId = Number(order_id);

    if (!paymentId) {
      res.status(400).json({ error: 'Invalid payment ID' });
      return;
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const statusMap: Record<string, PaymentStatus> = {
      settlement: PaymentStatus.paid,
      capture: PaymentStatus.paid,
      expire: PaymentStatus.failed,
      cancel: PaymentStatus.failed,
      deny: PaymentStatus.failed,
      refund: PaymentStatus.refunded
    };

    const status = statusMap[transaction_status] || PaymentStatus.pending;
    await prisma.payment.update({ where: { id: paymentId }, data: { status } });

    res.status(200).json({ message: 'Payment status updated successfully', status });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
};
