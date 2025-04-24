import { Request, Response } from 'express';
import prisma from '../../config/services/database';

export const getPromotionUsages = async (req: Request, res: Response) => {
  try {
    const { userId, promoId, bookingId } = req.query;
    const usages = await prisma.promotionUsage.findMany({
      where: {
        ...(userId ? { userId: parseInt(userId as string) } : {}),
        ...(promoId ? { promoId: parseInt(promoId as string) } : {}),
        ...(bookingId ? { bookingId: parseInt(bookingId as string) } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          include: {
            field: {
              select: {
                name: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        promo: true,
      },
    });
    res.json(usages);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createPromotionUsage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, bookingId, promoId } = req.body;

    const promotion = await prisma.promotion.findUnique({
      where: { id: promoId },
    });

    if (!promotion || promotion.status !== 'active') {
      res.status(400).json({ error: 'Invalid or inactive promotion' });
      return;
    }

    const now = new Date();
    if (now < promotion.validFrom || now > promotion.validUntil) {
      res.status(400).json({ error: 'Promotion has expired' });
      return;
    }

    const newPromotionUsage = await prisma.promotionUsage.create({
      data: { userId, bookingId, promoId },
    });

    res.status(201).json(newPromotionUsage);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create promotion usage' });
  }
};

export const deletePromotionUsage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.promotionUsage.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete promotion usage' });
  }
};
