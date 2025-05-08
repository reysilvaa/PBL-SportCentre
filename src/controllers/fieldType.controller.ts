import { Request, Response } from 'express';
import prisma from '../config/services/database';
import {
  createFieldTypeSchema,
  updateFieldTypeSchema,
} from '../zod-schemas/fieldType.schema';
import { invalidateFieldTypeCache } from '../utils/cache/cacheInvalidation.utils';
import { User } from '../middlewares/auth.middleware';

/**
 * Unified Field Type Controller
 * Mengelola endpoint terkait tipe lapangan
 */

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
  req: User,
  res: Response
): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createFieldTypeSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_FIELD_TYPE',
        details: `Membuat tipe lapangan baru "${result.data.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat tipe lapangan baru',
      data: newFieldType
    });
  } catch (error) {
    console.error('Error creating field type:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const updateFieldType = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const fieldTypeId = parseInt(id);
    
    if (isNaN(fieldTypeId)) {
      res.status(400).json({
        status: false,
        message: 'ID tipe lapangan tidak valid',
      });
      return;
    }

    // Validasi data dengan Zod
    const result = updateFieldTypeSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
      });
      return;
    }

    // Cek apakah tipe lapangan ada
    const existingFieldType = await prisma.fieldType.findUnique({
      where: { id: fieldTypeId },
    });

    if (!existingFieldType) {
      res.status(404).json({
        status: false,
        message: 'Tipe lapangan tidak ditemukan',
      });
      return;
    }

    const updatedFieldType = await prisma.fieldType.update({
      where: { id: fieldTypeId },
      data: {
        name: result.data.name,
      },
    });

    // Hapus cache terkait tipe lapangan
    await invalidateFieldTypeCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_FIELD_TYPE',
        details: `Memperbarui tipe lapangan "${existingFieldType.name}" menjadi "${result.data.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui tipe lapangan',
      data: updatedFieldType
    });
  } catch (error) {
    console.error('Error updating field type:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const deleteFieldType = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const fieldTypeId = parseInt(id);
    
    if (isNaN(fieldTypeId)) {
      res.status(400).json({
        status: false,
        message: 'ID tipe lapangan tidak valid',
      });
      return;
    }

    // Cek apakah tipe lapangan ada
    const existingFieldType = await prisma.fieldType.findUnique({
      where: { id: fieldTypeId },
    });

    if (!existingFieldType) {
      res.status(404).json({
        status: false,
        message: 'Tipe lapangan tidak ditemukan',
      });
      return;
    }

    // Cek apakah ada lapangan yang menggunakan tipe ini
    const existingField = await prisma.field.findFirst({
      where: { typeId: fieldTypeId },
    });

    if (existingField) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus tipe lapangan yang sedang digunakan',
      });
      return;
    }

    await prisma.fieldType.delete({
      where: { id: fieldTypeId },
    });

    // Hapus cache terkait tipe lapangan
    await invalidateFieldTypeCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_FIELD_TYPE',
        details: `Menghapus tipe lapangan "${existingFieldType.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus tipe lapangan'
    });
  } catch (error) {
    console.error('Error deleting field type:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
}; 