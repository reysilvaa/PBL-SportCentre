import { Response } from 'express';
import { createActivityLogSchema } from '../zod-schemas/activityLog.schema';
import { ActivityLogService } from '../utils/activityLog/activityLog.utils';
import { invalidateActivityLogCache } from '../utils/cache/cacheInvalidation.utils';
import { User } from '../middlewares/auth.middleware';
import { Role } from '../types';

/**
 * Unified Activity Log Controller
 * Untuk pengelolaan log aktivitas aplikasi
 */

export const getActivityLogs = async (req: User, res: Response): Promise<void> => {
  try {
    // Jika bukan super admin, batasi hanya untuk log sendiri
    let userId: number | undefined;

    if (req.user?.role !== Role.SUPER_ADMIN) {
      userId = req.user?.id;
    } else {
      // Super admin bisa melihat log berdasarkan userId dari query
      userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    }

    const logs = await ActivityLogService.getLogs(userId);

    // Force realtime update to all admins when API is called
    if (req.query.realtime === 'true') {
      await ActivityLogService.broadcastActivityLogUpdates();
    }

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan log aktivitas',
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      status: false,
      message: 'Gagal mengambil log aktivitas',
    });
  }
};

export const createActivityLog = async (req: User, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createActivityLogSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
      });
      return;
    }

    const { userId, action, details, relatedId } = result.data;

    // Pengguna biasa hanya bisa membuat log untuk diri sendiri
    if (req.user?.role !== 'super_admin' && userId !== req.user?.id) {
      res.status(403).json({
        status: false,
        message: 'Anda hanya dapat membuat log untuk diri sendiri',
      });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    const newLog = await ActivityLogService.createLog(
      userId,
      action,
      details,
      relatedId === null ? undefined : relatedId,
      ipAddress,
    );

    // Hapus cache activity logs
    await invalidateActivityLogCache(userId);

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat log aktivitas',
      data: newLog,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: 'Gagal membuat log aktivitas',
    });
  }
};

export const deleteActivityLog = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const logId = parseInt(id);

    // Hanya super admin yang bisa menghapus log aktivitas
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({
        status: false,
        message: 'Hanya super admin yang dapat menghapus log aktivitas',
      });
      return;
    }

    await ActivityLogService.deleteLog(logId);

    // Hapus cache activity logs (tanpa memberikan userId spesifik)
    await invalidateActivityLogCache();

    // Dapatkan IP address dari request
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    // Log aktivitas penghapusan log
    await ActivityLogService.createLog(
      req.user.id,
      'DELETE_ACTIVITY_LOG',
      `Menghapus log aktivitas dengan ID ${logId}`,
      logId,
      ipAddress,
    );

    res.status(200).json({
      status: true,
      message: 'Log aktivitas berhasil dihapus',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: 'Gagal menghapus log aktivitas',
    });
  }
};
