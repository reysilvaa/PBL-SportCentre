import { Request, Response } from 'express';
import prisma from '../config/database';

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
                name: true
              }
            }
          }
        }
      }
    });
    res.json(fieldTypes);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createFieldType = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const newFieldType = await prisma.fieldType.create({
      data: { name }
    });
    res.status(201).json(newFieldType);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create field type' });
  }
};

export const updateFieldType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedFieldType = await prisma.fieldType.update({
      where: { id: parseInt(id) },
      data: { name }
    });
    res.json(updatedFieldType);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update field type' });
  }
};

export const deleteFieldType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.fieldType.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete field type' });
  }
};