import { Request, Response } from 'express';
import prisma from '../config/database';
import { CreateFieldTypeDto } from '../dto/field/create-field-type.dto';
import { validate } from 'class-validator';

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

export const createFieldType = async (req: Request, res: Response): Promise<void> => {
  try {
  const createFieldTypeDto = new CreateFieldTypeDto();
    Object.assign(createFieldTypeDto, req.body);

    const errors = await validate(createFieldTypeDto);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return 
    }

    // Simpan ke database
    const newFieldType = await prisma.fieldType.create({
      data: {
        name: createFieldTypeDto.name
      }
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