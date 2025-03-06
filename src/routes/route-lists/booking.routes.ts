import express from 'express';
import { 
  getBookings, 
  createBooking, 
  updateBookingStatus, 
  deleteBooking 
} from '../../controllers/booking.controller';

const router = express.Router();

router.get('/', getBookings);
router.post('/', createBooking);
router.patch('/:id', updateBookingStatus);
router.delete('/:id', deleteBooking);

export default router;