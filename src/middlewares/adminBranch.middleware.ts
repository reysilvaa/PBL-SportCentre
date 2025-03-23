import { NextFunction, Response } from 'express';
import prisma from '../config/services/database';
import { User } from './auth.middleware';

/**
 * Middleware to verify users with branch access
 * Allows both owner_cabang and admin_cabang users who belong to a branch
 */
export const adminBranchMiddleware = async (
  req: User,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // User should already be attached from the authMiddleware
    const user = req.user;

    if (!user) {
      res.status(401).json({
        status: false,
        message: 'Unauthorized: Authentication required',
      });
      return;
    }

    if (user.role !== 'admin_cabang' && user.role !== 'owner_cabang') {
      res.status(403).json({
        status: false,
        message:
          'Forbidden: Hanya owner cabang atau admin cabang yang dapat mengakses fitur ini',
      });
      return;
    }

    // Check branch based on role
    let branch = null;

    if (user.role === 'owner_cabang') {
      // If owner, get the branch they own
      branch = await prisma.branch.findFirst({
        where: {
          ownerId: user.id,
          status: 'active',
        },
      });
    } else if (user.role === 'admin_cabang') {
      // If admin, get the branch they are admin for through BranchAdmin relation
      const branchAdmin = await prisma.branchAdmin.findFirst({
        where: {
          userId: user.id,
        },
        include: {
          branch: true,
        },
      });

      // Check if the branch is active
      if (branchAdmin?.branch && branchAdmin.branch.status === 'active') {
        branch = branchAdmin.branch;
      }
    }

    if (!branch) {
      res.status(403).json({
        status: false,
        message: 'Forbidden: Anda tidak terkait dengan cabang aktif manapun',
      });
      return;
    }

    // Attach branch information to request for later use
    req.userBranch = branch;

    next();
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error,
    });
  }
};
