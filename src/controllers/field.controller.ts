import { Request, Response } from 'express';
import prisma from '../config/database';

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

export const createField = async (req: Request, res: Response) => {
  try {
    const { branchId, typeId, name, priceDay, priceNight, status } = req.body;
    const newField = await prisma.field.create({
      data: {
        branchId,
        typeId,
        name,
        priceDay,
        priceNight,
        status: status || 'available'
      }
    });
    res.status(201).json(newField);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create field' });
  }
};

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