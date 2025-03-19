import { Request, Response } from 'express';
import prisma from '../../config/database';
import { updateFieldSchema } from '../../zod-schemas/field.schema';
import { deleteCachedDataByPattern } from '../../utils/cache';
import { deleteImage, extractPublicId } from '../../config/cloudinary';
import { MulterRequest } from '@/middlewares/multer.middleware';

export const getFields = async (req: Request, res: Response) => {
  try {
    const fields = await prisma.field.findMany({
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        type: true
      }
    });
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
