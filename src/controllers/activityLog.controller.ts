import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../config/database';
import { CreateActivityLogDto } from '../dto/activityLog/create-activity-log.dto';

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const logs = await prisma.activityLog.findMany({
      where: userId ? { userId: parseInt(userId as string) } : {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createActivityLog = async (req: Request, res: Response): Promise<void> => { 
  try {
    const dto = new CreateActivityLogDto();
    Object.assign(dto, req.body);
    
    const errors = await validate(dto);
    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    const newLog = await prisma.activityLog.create({
      data: {
        userId: dto.userId,
        action: dto.action
      }
    });

    res.status(201).json(newLog); 
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create activity log' });
  }
};


export const deleteActivityLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.activityLog.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete activity log' });
  }
};
