import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../../config/database';
import { CreateFieldDto } from '../../dto/field/create-field.dto';

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
    // Konversi request body ke DTO dengan data yang sesuai
    const fieldDto = new CreateFieldDto();
    Object.assign(fieldDto, req.body);

    // Validasi input
    const errors = await validate(fieldDto);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    // Ambil data setelah validasi
    const { branchId, typeId, name, priceDay, priceNight } = fieldDto;
    const status = req.body.status || 'available'; // Tetapkan default jika tidak ada status

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
    res.status(400).json({ error: 'Failed to create field' });
  }
};

// dto update blom ini buat verifikasi
export const updateField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { typeId, name, priceDay, priceNight, status } = req.body;
    const updatedField = await prisma.field.update({
      where: { id: parseInt(id) },
      data: {
        typeId,
        name,
        priceDay,
        priceNight,
        status
      }
    });
    res.json(updatedField);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update field' });
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
    res.status(400).json({ error: 'Failed to delete field' });
  }
};