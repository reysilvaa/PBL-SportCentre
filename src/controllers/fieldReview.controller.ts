import { Request, Response } from 'express';
import prisma from '../config/database';
import { plainToInstance } from 'class-transformer';
import { CreateFieldReviewDto } from '../dto/review/create-review.dto';
import { validate } from 'class-validator';

export const getFieldReviews = async (req: Request, res: Response) => {
  try {
    const { fieldId, userId } = req.query;
    const reviews = await prisma.fieldReview.findMany({
      where: {
        ...(fieldId ? { fieldId: parseInt(fieldId as string) } : {}),
        ...(userId ? { userId: parseInt(userId as string) } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        field: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


export const createFieldReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const createFieldReviewDto = new CreateFieldReviewDto();
    Object.assign(createFieldReviewDto, req.body);

    const errors = await validate(createFieldReviewDto);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return; 
    }
    const { userId, fieldId, rating, review } = createFieldReviewDto;
    const newReview = await prisma.fieldReview.create({
      data: {
        userId,
        fieldId,
        rating,
        review
      }
    });

    res.status(201).json(newReview);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create field review' });
  }
};

export const updateFieldReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const updatedReview = await prisma.fieldReview.update({
      where: { id: parseInt(id) },
      data: {
        rating,
        review
      }
    });
    res.json(updatedReview);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update field review' });
  }
};

export const deleteFieldReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.fieldReview.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete field review' });
  }
};