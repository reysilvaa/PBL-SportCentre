// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app/env';
import { getAuthToken } from '../utils/cookies.utils';
import { isTokenBlacklisted } from '../utils/token-blacklist.utils';

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

export type AuthenticatedRequestHandler = RequestHandler<
  any,
  any,
  any,
  any,
  { user?: { id: number; role: string } }
>;

export const authMiddleware = (allowedRoles: string[] = []) => {
  return (req: User, res: Response, next: NextFunction): void => {
    // Coba ambil token dari header Authorization
    const headerToken = req.header('Authorization')?.split(' ')[1];

    // Coba ambil token dari cookie
    const cookieToken = getAuthToken(req);

    // Gunakan token dari cookie jika ada, atau dari header jika tidak ada di cookie
    const token = cookieToken || headerToken;

    if (!token) {
      res.status(401).json({
        status: false,
        message: 'Unauthorized: Token tidak ditemukan',
      });
      return;
    }

    // Periksa jika token ada di blacklist
    if (isTokenBlacklisted(token)) {
      res.status(401).json({
        status: false,
        message: 'Unauthorized: Token telah dicabut atau tidak valid',
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: number;
        role: string;
      };
      req.user = decoded;

      // Check if user's role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json({
          status: false,
          message: 'Forbidden: Anda tidak memiliki izin untuk akses ini',
        });
        return;
      }

      next();
    } catch (error) {
      // Jika token tidak valid karena expired, tambahkan pesan khusus
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          status: false,
          message: 'Unauthorized: Token telah kedaluwarsa',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      res.status(401).json({
        status: false,
        message: 'Unauthorized: Token tidak valid',
      });
    }
  };
};

// Middleware khusus untuk super admin
export const superAdminAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  return authMiddleware(['super_admin'])(req, res, next);
};

// Middleware khusus untuk admin cabang
export const branchAdminAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  return authMiddleware(['admin_cabang'])(req, res, next);
};

// Middleware khusus untuk owner cabang
export const ownerAuth = (req: Request, res: Response, next: NextFunction) => {
  return authMiddleware(['owner_cabang'])(req, res, next);
};
export const userAuth = (req: Request, res: Response, next: NextFunction) => {
  return authMiddleware(['user'])(req, res, next);
};
