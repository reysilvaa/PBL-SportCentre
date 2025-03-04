import { Request, Response } from 'express';
import prisma from '../config/database';

export const getPromotions = async (req: Request, res: Response) => {
  try {
    const promotions = await prisma.promotion.findMany({
      include: {
        PromoUsages: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createPromotion = async (req: Request, res: Response) => {
  try {
    const { 
      code, 
      description, 
      discountPercent, 
      maxDiscount, 
      validFrom, 
      validUntil, 
      status 
    } = req.body;

    const newPromotion = await prisma.promotion.create({
      data: {
        code,
        description,
        discountPercent,
        maxDiscount,
        validFrom,
        validUntil,
        status: status || 'active'
      }
    });
    res.status(201).json(newPromotion);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create promotion' });
  }
};

export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      code, 
      description, 
      discountPercent, 
      maxDiscount, 
      validFrom, 
      validUntil, 
      status 
    } = req.body;

    const updatedPromotion = await prisma.promotion.update({
      where: { id: parseInt(id) },
      data: {
        code,
        description,
        discountPercent,
        maxDiscount,
        validFrom,
        validUntil,
        status
      }
    });
    res.json(updatedPromotion);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update promotion' });
  }
};

export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.promotion.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete promotion' });
  }
};