
// src/controllers/userController.ts
import { Request, Response } from 'express';
import prisma from '../config/database';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
