import { Request, Response } from 'express';
import prisma from '../config/database';

export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        booking: {
          include: { field: { select: { name: true, branch: { select: { name: true } } } } }
        },
        user: { select: { id: true, name: true, email: true } }
      }
    });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, userId, amount, paymentMethod, status = 'pending' } = req.body;

    if (!bookingId || !userId || !amount || !paymentMethod) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const newPayment = await prisma.payment.create({
      data: { bookingId, userId, amount, paymentMethod, status }
    });

    res.status(201).json(newPayment);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create payment' });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    res.json(await prisma.payment.update({ where: { id }, data: { status } }));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update payment' });
  }
};

export const deletePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.payment.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete payment' });
  }
};
