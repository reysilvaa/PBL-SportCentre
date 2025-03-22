import express from 'express';
import { handleMidtransNotification } from '../../controllers/webhook-handlers/midtrans.controller';

const router = express.Router();

// Midtrans webhook endpoint
router.post('/midtrans', handleMidtransNotification);

export default router;
