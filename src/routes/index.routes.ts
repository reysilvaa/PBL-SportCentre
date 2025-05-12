import express from 'express';
import userRoutes from './route-lists/user.routes';
import branchRoutes from './route-lists/branch.routes';
import fieldRoutes from './route-lists/field.routes';
import bookingRoutes from './route-lists/booking.routes';
import fieldTypeRoutes from './route-lists/fieldTypes.routes';
import activityLogRoutes from './route-lists/activityLog.routes';
import fieldReviewRoutes from './route-lists/fieldReview.routes';
import promotionRoutes from './route-lists/promotion.routes';
import promotionUsageRoutes from './route-lists/promotionUsage.routes';
import authRoutes from './route-lists/auth.routes';
import webhookRoutes from './route-lists/webhook.routes';
import notificationRoutes from './route-lists/notification.routes';
import dashboardRoutes from './route-lists/dashboard.routes';
import redisClient, { getCacheStats } from '../utils/cache.utils';
import { auth } from '../middlewares/auth.middleware';

const router = express.Router();

// Gunakan routes yang terpisah
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/fields', fieldRoutes);
router.use('/bookings', bookingRoutes);
router.use('/field-types', fieldTypeRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/field-reviews', fieldReviewRoutes);
router.use('/promotions', promotionRoutes);
router.use('/promotion-usages', promotionUsageRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);

// Endpoint untuk health check dan monitoring
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Service is running' });
});

// Endpoint untuk statistik cache (admin only)
router.get('/cache-stats', auth({ allowedRoles: ['super_admin'] }), async (req, res) => {
  try {
    const stats = await getCacheStats();
    const pattern = req.query.pattern as string;

    const keys: string[] = [];
    if (pattern) {
      // Cari keys dengan pattern
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: `*${pattern}*`,
          COUNT: 100,
        });

        cursor = result.cursor;
        if (result.keys.length > 0) {
          keys.push(...result.keys);
        }
      } while (cursor !== 0);
    }

    res.json({
      stats,
      keys: pattern ? keys : undefined,
      keysCount: pattern ? keys.length : undefined,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
