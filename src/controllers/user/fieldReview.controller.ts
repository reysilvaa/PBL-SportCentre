import { Request, Response } from 'express';
import prisma from '../../config/database';
import {
  createFieldReviewSchema,
  updateFieldReviewSchema,
} from '../../zod-schemas/fieldReview.schema';
import { deleteCachedDataByPattern } from '../../utils/cache.utils';

export const getFieldReviews = async (req: Request, res: Response) => {
  try {
    const { fieldId, userId } = req.query;
    const reviews = await prisma.fieldReview.findMany({
      where: {
        ...(fieldId ? { fieldId: parseInt(fieldId as string) } : {}),
        ...(userId ? { userId: parseInt(userId as string) } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createFieldReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createFieldReviewSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { userId, fieldId, rating, review } = result.data;
    const newReview = await prisma.fieldReview.create({
      data: {
        userId,
        fieldId,
        rating,
        review,
      },
    });

    // Hapus cache field reviews
    deleteCachedDataByPattern('field_reviews');

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateFieldReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validasi data dengan Zod
    const result = updateFieldReviewSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const updatedReview = await prisma.fieldReview.update({
      where: { id: parseInt(id) },
      data: result.data,
    });

    // Hapus cache field reviews
    deleteCachedDataByPattern('field_reviews');

    res.json(updatedReview);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteFieldReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.fieldReview.delete({
      where: { id: parseInt(id) },
    });

    // Hapus cache field reviews
    deleteCachedDataByPattern('field_reviews');

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
