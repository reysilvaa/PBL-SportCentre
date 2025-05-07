import { Request, Response } from 'express';
import { createActivityLogSchema } from '../../../zod-schemas/activityLog.schema';
import { ActivityLogService } from '../../../utils/activityLog/activityLog.utils';
import { invalidateActivityLogCache } from '../../../utils/cache/cacheInvalidation.utils';

export const getActivityLogs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;
    const logs = await ActivityLogService.getLogs(userId);

    // Force realtime update to all admins when API is called
    if (req.query.realtime === 'true') {
      await ActivityLogService.broadcastActivityLogUpdates();
    }

    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Gagal mengambil log aktivitas' });
  }
};

export const createActivityLog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = createActivityLogSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { userId, action, details, relatedId } = result.data;

    const newLog = await ActivityLogService.createLog(
      userId,
      action,
      details,
      relatedId === null ? undefined : relatedId
    );

    // Hapus cache activity logs
    await invalidateActivityLogCache(userId);

    res.status(201).json(newLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat log aktivitas' });
  }
};

export const deleteActivityLog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const logId = parseInt(id);
    
    await ActivityLogService.deleteLog(logId);

    // Hapus cache activity logs (tanpa memberikan userId spesifik)
    await invalidateActivityLogCache();

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menghapus log aktivitas' });
  }
};
