// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface User extends Request {
  user?: {
    id: number;
    role: string;
  };
}

export const authMiddleware = (allowedRoles: string[] = []) => {
  return (req: User, res: Response, next: NextFunction): void => {
    const token = req.header('Authorization')?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
      req.user = decoded;
      
      // Check if user's role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json({ error: 'Forbidden: You do not have permission' });
        return;
      }
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};
