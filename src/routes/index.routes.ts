import express from 'express';
import userRoutes from './route-lists/user.routes';
import branchRoutes from './route-lists/branch.routes';
import fieldRoutes from './route-lists/field.routes';
import bookingRoutes from './route-lists/booking.routes';
import fieldTypeRoutes from './route-lists/fieldTypes.routes';
// import paymentRoutes from './route-lists/payment.routes';
import activityLogRoutes from './route-lists/activityLog.routes';
import fieldReviewRoutes from './route-lists/fieldReview.routes';
import promotionRoutes from './route-lists/promotion.routes';
import promotionUsageRoutes from './route-lists/promotionUsage.routes';
import authRoutes from './route-lists/auth.routes';
import webhookRoutes from './route-lists/webhook.routes';
import notificationRoutes from './route-lists/notification.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/fields', fieldRoutes);
router.use('/bookings', bookingRoutes);
router.use('/field-types', fieldTypeRoutes);
// router.use('/payments', paymentRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/field-reviews', fieldReviewRoutes);
router.use('/promotions', promotionRoutes);
router.use('/promotion-usages', promotionUsageRoutes);
router.use('/midtrans-notification', webhookRoutes);
router.use('/notification', notificationRoutes);

export default router;