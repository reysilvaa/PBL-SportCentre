import { Router } from 'express';
import * as userBookingController from '../../controllers/user/booking.controller';
import * as branchAdminBookingController from '../../controllers/admin/admin_cabang/booking.controller';
import * as superAdminBookingController from '../../controllers/admin/super_admin/booking.controller';
import * as ownerBookingController from '../../controllers/owner/booking.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// User routes
router.post('/', userBookingController.createBooking);
router.get('/users/:userId/bookings', userBookingController.getUserBookings);
router.get('/bookings/:id/user', userBookingController.getBookingById);

// Branch admin routes
router.get('/branches/:branchId/bookings', 
   authMiddleware(['admin_cabang']), 
  branchAdminBookingController.getBranchBookings
);
router.get('/branches/:branchId/bookings/:id', 
  authMiddleware(['admin_cabang']), 
  branchAdminBookingController.getBranchBookingById
);
router.put('/branches/:branchId/bookings/:id/status', 
  authMiddleware(['admin_cabang']), 
  branchAdminBookingController.updateBranchBookingStatus
);
router.post('/branches/:branchId/bookings/manual', 
  authMiddleware(['admin_cabang']), 
  branchAdminBookingController.createManualBooking
);

// Super admin routes
router.get('/admin/bookings', 
    authMiddleware(['super_admin']), 
    superAdminBookingController.getAllBookings
);
router.get('/admin/bookings/:id', 
  authMiddleware(['super_admin']), 
  superAdminBookingController.getBookingById
);
router.put('/admin/bookings/:id/payment', 
  authMiddleware(['super_admin']), 
  superAdminBookingController.updateBookingPayment
);
router.delete('/admin/bookings/:id', 
  authMiddleware(['super_admin']), 
  superAdminBookingController.deleteBooking
);
router.get('/admin/bookings/stats', 
  authMiddleware(['super_admin']), 
  superAdminBookingController.getBookingStats
);

// Owner routes
// exp : http://localhost:3000/api/bookings/owner/reports/revenue?type=daily&startDate=2025-03-01&endDate=2025-03-07
router.get('/owner/reports/revenue', 
//   authMiddleware(['owner_cabang']), 
  ownerBookingController.getRevenueReports
);
router.get('/owner/reports/occupancy', 
    authMiddleware(['super_admin']), 
  ownerBookingController.getOccupancyReports
);
router.get('/owner/reports/performance', 
  authMiddleware(['super_admin']), 
  ownerBookingController.getBusinessPerformance
);
router.get('/owner/reports/forecast', 
  authMiddleware(['super_admin']), 
  ownerBookingController.getBookingForecast
);

export default router;