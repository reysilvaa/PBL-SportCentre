import express from 'express';
import * as bookingController from '../../controllers/booking.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = express.Router();

router.get('/', authMiddleware(['super_admin']), bookingController.getBookings);
router.get('/:id', authMiddleware(), bookingController.getBookingById);
router.get('/user/:userId', authMiddleware(), bookingController.getUserBookings);
router.post('/', authMiddleware(), bookingController.createBooking);
router.put('/:id/status', authMiddleware(), bookingController.updateBookingStatus);
router.delete('/:id', authMiddleware(), bookingController.deleteBooking);

export default router;