import express from 'express';
import * as paymentController from '../../controllers/payment.controller';
import * as midtransController from '../../controllers/midtrans.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get('/', authMiddleware(), paymentController.getPayments);
router.get('/:id', authMiddleware(), paymentController.getPaymentById);
router.get('/user/:userId', authMiddleware(), paymentController.getUserPayments);
router.get('/:id/status', authMiddleware(), midtransController.getPaymentStatus);
router.post('/', authMiddleware(), paymentController.createPayment);
router.put('/:id/status', authMiddleware(), paymentController.updatePaymentStatus);
router.post('/:id/retry', authMiddleware(), paymentController.retryPayment);
router.delete('/:id', authMiddleware(), paymentController.deletePayment);

// Midtrans notification webhook (no auth required as it's called by Midtrans)
router.post('/notification', midtransController.handleMidtransNotification);

export default router;
