// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface User extends Request {
  user?: {
    id: number;
    role: string;
  };
  userBranch?: {
    id: number;
    name: string;
    location: string;
    ownerId: number;
    status: string;
    createdAt: Date;
  };
}

export const authMiddleware = (allowedRoles: string[] = []) => {
  return (req: User, res: Response, next: NextFunction): void => {
    const token = req.header('Authorization')?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ 
        status: false, 
        message: 'Unauthorized: Token tidak ditemukan' 
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
      req.user = decoded;
      
      // Check if user's role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json({ 
          status: false, 
          message: 'Forbidden: Anda tidak memiliki izin untuk akses ini' 
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(401).json({ 
        status: false, 
        message: 'Unauthorized: Token tidak valid' 
      });
    }
  };
};