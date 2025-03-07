// import { Router } from 'express';
// import { getPayments, getPaymentById, getUserPayments, updatePaymentStatus, retryPayment, deletePayment } from '../../controllers/payment.controller';
// import { authMiddleware } from '../../middlewares/auth.middleware';

// const router = Router();

// // Admin routes
// router.get('/', authMiddleware(['super_admin']), getPayments);
// router.get('/:id', authMiddleware(), getPaymentById);

// // User routes
// router.get('/user/:userId', authMiddleware(), getUserPayments);
// router.patch('/:id', authMiddleware(), updatePaymentStatus);
// router.post('/:id/retry', authMiddleware(), retryPayment);
// router.delete('/:id', authMiddleware(), deletePayment);

// export default router;