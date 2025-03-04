import express from 'express';
import { 
  getPayments, 
  createPayment, 
  updatePaymentStatus, 
  deletePayment 
} from '../controllers/payment.controller';

const router = express.Router();

router.get('/', getPayments);
router.post('/', createPayment);
router.patch('/:id', updatePaymentStatus);
router.delete('/:id', deletePayment);

export default router;