import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import {
  createFieldTypeSchema,
  updateFieldTypeSchema,
} from '../../zod-schemas/fieldType.schema';
import { invalidateFieldTypeCache } from '../../utils/cache/cacheInvalidation.utils';

export const getFieldTypes = async (req: Request, res: Response) => {
  try {
    const fieldTypes = await prisma.fieldType.findMany({
      include: {
        Fields: {
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
    });
    res.json(fieldTypes);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createFieldType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createFieldTypeSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    // Simpan ke database
    const newFieldType = await prisma.fieldType.create({
      data: {
        name: result.data.name,
      },
    });

    // Hapus cache terkait tipe lapangan
    await invalidateFieldTypeCache();

    res.status(201).json(newFieldType);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateFieldType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validasi data dengan Zod
    const result = updateFieldTypeSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const updatedFieldType = await prisma.fieldType.update({
      where: { id: parseInt(id) },
      data: {
        name: result.data.name,
      },
    });

    // Hapus cache terkait tipe lapangan
    await invalidateFieldTypeCache();

    res.json(updatedFieldType);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteFieldType = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Cek apakah ada lapangan yang menggunakan tipe ini
    const existingField = await prisma.field.findFirst({
      where: { typeId: parseInt(id) },
    });

    if (existingField) {
      res.status(400).json({
        error: 'Tidak dapat menghapus tipe lapangan yang sedang digunakan',
      });
    }

    await prisma.fieldType.delete({
      where: { id: parseInt(id) },
    });

    // Hapus cache terkait tipe lapangan
    await invalidateFieldTypeCache();

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
