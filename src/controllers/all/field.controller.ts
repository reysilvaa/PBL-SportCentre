import { Request, Response } from 'express';
import prisma from '../../config/database';
import { createFieldSchema, updateFieldSchema } from '../../zod-schemas/field.schema';

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

export const createField = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createFieldSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validasi gagal', 
        details: result.error.format() 
      });
      return;
    }

    // Ambil data setelah validasi
    const { branchId, typeId, name, priceDay, priceNight, status } = result.data;

    // Simpan data ke database
    const newField = await prisma.field.create({
      data: {
        branchId,
        typeId,
        name,
        priceDay,
        priceNight,
        status,
      }
    });

    res.status(201).json(newField);
  } catch (error) {
    res.status(400).json({ error: 'Gagal membuat lapangan' });
  }
};

export const updateField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validasi data dengan Zod
    const result = updateFieldSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validasi gagal', 
        details: result.error.format() 
      });
      return;
    }
    
    const updatedField = await prisma.field.update({
      where: { id: parseInt(id) },
      data: result.data
    });
    res.json(updatedField);
  } catch (error) {
    res.status(400).json({ error: 'Gagal memperbarui lapangan' });
  }
};

export const deleteField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.field.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Gagal menghapus lapangan' });
  }
};