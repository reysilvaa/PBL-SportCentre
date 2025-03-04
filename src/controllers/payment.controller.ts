import { Request, Response } from 'express';
import prisma from '../config/database';

export const getPayments = async (req: Request, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        booking: {
          include: {
            field: {
              select: {
                name: true,
                branch: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const { bookingId, userId, amount, paymentMethod, status } = req.body;
    const newPayment = await prisma.payment.create({
      data: {
        bookingId,
        userId,
        amount,
        paymentMethod,
        status: status || 'pending'
      }
    });
    res.status(201).json(newPayment);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create payment' });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    res.json(updatedPayment);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update payment' });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.payment.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete payment' });
  }
};