import express from 'express';
import { 
  getBookings, 
  createBooking, 
  updateBookingStatus, 
  deleteBooking
} from '../../controllers/booking.controller';

import { 
  checkFieldAvailability,
  getAvailableTimeSlots
} from '../../controllers/availability.controller';

import { validateDateMiddleware } from '../../middlewares/validateDate.middleware';

const router = express.Router();

// Booking CRUD routes
router.get('/', getBookings);
router.post('/', validateDateMiddleware, createBooking);
router.put('/:id/status', updateBookingStatus);
router.delete('/:id', deleteBooking);

// Availability routes
router.get('/availability', checkFieldAvailability);
router.get('/available-slots', getAvailableTimeSlots);

export default router;