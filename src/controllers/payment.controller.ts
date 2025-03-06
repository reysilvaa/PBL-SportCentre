import { Request, Response } from 'express';
import prisma from '../config/database';
import midtrans from '../config/midtrans';

export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        booking: {
          include: { 
            field: { 
              select: { 
                name: true, 
                branch: { select: { name: true } } 
              } 
            } 
          }
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

export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        booking: {
          include: { 
            field: { 
              select: { 
                name: true, 
                branch: { select: { name: true } } 
              } 
            },
            user: { select: { name: true, email: true, phone: true } }
          }
        }
      }
    });
    
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    
    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const payments = await prisma.payment.findMany({
      where: { userId: parseInt(userId) },
      include: {
        booking: {
          include: { field: { include: { branch: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
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

    // Check if booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        field: { include: { branch: true } },
        user: { select: { name: true, email: true, phone: true } }
      }
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Check if there's already a payment for this booking (using the unique constraint)
    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId }
    });

    if (existingPayment) {
      res.status(400).json({ error: 'Payment already exists for this booking' });
      return;
    }

    const newPayment = await prisma.payment.create({
      data: { bookingId, userId, amount, paymentMethod, status }
    });

    // If payment method is Midtrans, create a transaction
    if (paymentMethod === 'midtrans') {
      const transaction = await midtrans.createTransaction({
        transaction_details: {
          order_id: `PAY-${newPayment.id}`,
          gross_amount: amount
        },
        customer_details: {
          first_name: booking.user.name,
          email: booking.user.email,
          phone: booking.user.phone
        },
        item_details: [
          {
            id: booking.field.id.toString(),
            name: `${booking.field.branch.name} - ${booking.field.name}`,
            price: amount,
            quantity: 1
          }
        ]
      });

      if (!transaction.redirect_url) {
        console.error("Midtrans failed to generate redirect URL");
        res.status(500).json({ error: "Failed to initiate payment" });
        return;
      }

      res.status(201).json({
        payment: newPayment,
        redirect_url: transaction.redirect_url
      });
    } else {
      res.status(201).json(newPayment);
    }
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

    const updatedPayment = await prisma.payment.update({ 
      where: { id }, 
      data: { status },
      include: { booking: true }
    });

    // No need to update booking.payment as it's a relation, not a field
    // The booking is already linked to this payment

    res.json(updatedPayment);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update payment' });
  }
};

export const retryPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: { 
            field: { include: { branch: true } },
            user: { select: { name: true, email: true, phone: true } }
          }
        }
      }
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (payment.status === 'paid') {
      res.status(400).json({ error: 'Payment already completed' });
      return;
    }

    const transaction = await midtrans.createTransaction({
      transaction_details: {
        order_id: `PAY-${payment.id}-RETRY-${Date.now()}`,
        gross_amount: payment.amount
      },
      customer_details: {
        first_name: payment.booking.user.name,
        email: payment.booking.user.email,
        phone: payment.booking.user.phone
      },
      item_details: [
        {
          id: payment.booking.field.id.toString(),
          name: `${payment.booking.field.branch.name} - ${payment.booking.field.name}`,
          price: payment.amount,
          quantity: 1
        }
      ]
    });

    if (!transaction.redirect_url) {
      console.error("Midtrans failed to generate redirect URL");
      res.status(500).json({ error: "Failed to initiate payment" });
      return;
    }

    // Update payment status to pending
    await prisma.payment.update({
      where: { id },
      data: { status: 'pending' }
    });

    res.json({
      message: 'Payment retry initiated',
      redirect_url: transaction.redirect_url
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to retry payment' });
  }
};

export const deletePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    
    const payment = await prisma.payment.findUnique({
      where: { id }
    });
    
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    
    // Delete the payment (no need to update booking status as the relation will be removed)
    await prisma.payment.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete payment' });
  }
};