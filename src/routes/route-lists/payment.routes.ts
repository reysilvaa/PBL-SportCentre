import express from 'express';
import { 
  getPayments, 
  createPayment, 
  updatePaymentStatus, 
  deletePayment,
  // createMidtransTransaction,
  // midtransWebhook
} from '../../controllers/payment.controller';

const router = express.Router();

// Standard payment routes
router.get('/', getPayments);
router.post('/', createPayment);
router.patch('/:id', updatePaymentStatus);
router.delete('/:id', deletePayment);

// Midtrans payment routes
// router.post('/midtrans', createMidtransTransaction);
// router.post('/midtrans/webhook', midtransWebhook);

export default router;