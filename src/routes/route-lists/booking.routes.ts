import { Router } from 'express';
import * as userBookingController from '../../controllers/user/booking.controller';
import * as branchAdminBookingController from '../../controllers/admin/admin_cabang/booking.controller';
import * as superAdminBookingController from '../../controllers/admin/super_admin/booking.controller';
import * as ownerBookingController from '../../controllers/owner/booking.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache';

const router = Router();

// User routes
router.post('/', userBookingController.createBooking);
router.get('/users/:userId/bookings', cacheMiddleware('user_bookings', 120), userBookingController.getUserBookings);
router.get('/bookings/:id/user', cacheMiddleware('booking_detail', 120), userBookingController.getBookingById);

// Branch admin routes
router.get('/branches/:branchId/bookings', 
   authMiddleware(['admin_cabang']), 
   cacheMiddleware('branch_bookings', 60),
   branchAdminBookingController.getBranchBookings
);
router.get('/branches/:branchId/bookings/:id', 
  authMiddleware(['admin_cabang']), 
  cacheMiddleware('branch_booking_detail', 60),
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
    cacheMiddleware('admin_all_bookings', 120),
    superAdminBookingController.getAllBookings
);
router.get('/admin/bookings/:id', 
  authMiddleware(['super_admin']), 
  cacheMiddleware('admin_booking_detail', 60),
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
  cacheMiddleware('admin_booking_stats', 300),
  superAdminBookingController.getBookingStats
);

// Owner routes
// exp : http://localhost:3000/api/bookings/owner/reports/revenue?type=daily&startDate=2025-03-01&endDate=2025-03-07
router.get('/owner/reports/revenue', 
  authMiddleware(['owner_cabang']), 
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

// router.get('/owner/branches/:branchId/bookings', 
//   authMiddleware(['owner_cabang']), 
//   cacheMiddleware('owner_branch_bookings', 120),
//   ownerBookingController.getBranchBookings
// );
// router.get('/owner/branches/:branchId/bookings/:id', 
//   authMiddleware(['owner_cabang']), 
//   cacheMiddleware('owner_branch_booking_detail', 60),
//   ownerBookingController.getBranchBookingById
// );

export default router;