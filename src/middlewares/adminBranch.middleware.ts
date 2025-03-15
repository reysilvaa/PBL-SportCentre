import { NextFunction, Response } from 'express';
import prisma from '../config/database';
import { User } from './auth.middleware';

/**
 * Middleware to verify users with branch access
 * Allows both owner_cabang and admin_cabang users who belong to a branch
 */
export const adminBranchMiddleware = async (req: User, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User should already be attached from the authMiddleware
    const user = req.user;
    
    if (!user || (user.role !== 'admin_cabang' && user.role !== 'owner_cabang')) {
      res.status(403).json({ 
        status: false,
        message: 'Forbidden: Hanya owner cabang atau admin cabang yang dapat mengakses fitur ini' 
      });
    }
    
    // Get branch information
    const branch = await prisma.branch.findFirst({
      where: { 
        ownerId: user!.id,
        status: 'active'
      }
    });
    
    if (!branch) {
      res.status(403).json({ 
        status: false,
        message: 'Forbidden: Anda tidak terkait dengan cabang manapun' 
      });
    }
    
    // Attach branch information to request for later use
    req.userBranch = branch!;
    
    next();
  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error',
      error: error 
    });
  }
};