import { Request, Response } from 'express';
import prisma from '../../config/database';

export const getFields = async (req: Request, res: Response) => {
  try {
    const fields = await prisma.field.findMany({
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        type: true,
      },
    });
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
