import express from 'express';
import { getActivityLogs, createActivityLog, deleteActivityLog } from '../../controllers/activityLog.controller';
import { auth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';

const router = express.Router();

// Mendapatkan log aktivitas - semua user bisa akses, tapi role menentukan scope data
router.get('/', auth(), cacheMiddleware('activity_logs', 120), getActivityLogs);

// Membuat log aktivitas - tetap menggunakan otentikasi
router.post('/', auth(), createActivityLog);

// Menghapus log aktivitas - hanya super admin
router.delete(
  '/:id',
  auth({
    allowedRoles: ['super_admin'],
  }),
  deleteActivityLog,
);

export default router;
