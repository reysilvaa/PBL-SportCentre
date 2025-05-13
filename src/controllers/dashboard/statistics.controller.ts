import { Request, Response } from 'express';
import { Role } from '../../types';
import * as UnifiedStatsService from '../../repositories/statistics/unifiedStats.service';
import { PeriodType } from '../../repositories/statistics/unifiedStats.service';

// Deklarasi tambahan untuk extend tipe Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
      };
    }
  }
}

/**
 * Controller untuk mendapatkan statistik dashboard berdasarkan role dan periode
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'monthly' } = req.query as { period?: PeriodType };
    const userId = req.user?.id;

    if (!Role || !userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Mendapatkan rentang waktu berdasarkan periode
    const timeRange = UnifiedStatsService.getTimeRange(period);

    // Mendapatkan statistik berdasarkan role
    let stats: UnifiedStatsService.DashboardStats;
    switch (req.user?.role) {
      case Role.SUPER_ADMIN:
        stats = await UnifiedStatsService.getSuperAdminStatsWithCharts(timeRange);
        break;
      case Role.OWNER_CABANG:
        stats = await UnifiedStatsService.getOwnerCabangStats(userId, timeRange);
        break;
      case Role.ADMIN_CABANG:
        stats = await UnifiedStatsService.getAdminCabangStats(userId, timeRange);
        break;
      case Role.USER:
        stats = await UnifiedStatsService.getUserStats(userId, timeRange);
        break;
      default:
        res.status(400).json({ message: 'Role tidak valid' });
        return;
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil statistik dashboard' });
  }
}; 