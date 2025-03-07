import { Router } from 'express';
import { handleMidtransNotification } from '../../controllers/webhooks/webhook.controller';

const router = Router();

// This route doesn't need auth middleware since it's called by Midtrans
router.post('/', handleMidtransNotification);

export default router;