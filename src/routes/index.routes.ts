import express from 'express';
import userRoutes from './user.routes';
import branchRoutes from './branch.routes';
import fieldRoutes from './field.routes';
import bookingRoutes from './booking.routes';
import fieldTypeRoutes from './fieldTypes.routes';
import paymentRoutes from './payment.routes';
import activityLogRoutes from './activityLog.routes';
import fieldReviewRoutes from './fieldReview.routes';
import promotionRoutes from './promotion.routes';
import promotionUsageRoutes from './promotionUsage.routes';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/fields', fieldRoutes);
router.use('/bookings', bookingRoutes);
router.use('/field-types', fieldTypeRoutes);
router.use('/payments', paymentRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/field-reviews', fieldReviewRoutes);
router.use('/promotions', promotionRoutes);
router.use('/promotion-usages', promotionUsageRoutes);

export default router;