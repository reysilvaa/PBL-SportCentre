// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface CustomRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'super_admin' | 'admin_cabang' | 'owner_cabang' | 'user';
  };
}

export const authMiddleware = (req: CustomRequest, res: Response, next: NextFunction): void => {
  const token = req.header('Authorization')?.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as CustomRequest['user'];
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};