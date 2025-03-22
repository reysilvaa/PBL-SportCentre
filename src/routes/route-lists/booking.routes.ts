import { Router } from 'express';
import * as userBookingController from '../../controllers/user/booking.controller';
import * as branchAdminBookingController from '../../controllers/admin/admin_cabang/booking.controller';
import * as superAdminBookingController from '../../controllers/admin/super_admin/booking.controller';
import * as ownerBookingController from '../../controllers/owner/booking.controller';
import {
  superAdminAuth,
  branchAdminAuth,
  ownerAuth,
  userAuth,
} from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { bookingRateLimiter } from '../../middlewares/security.middleware';

const router = Router();

// ======== USER ROUTES ========
// Endpoint pembuatan booking dengan rate limiter
router.post(
  '/',
  userAuth,
  bookingRateLimiter,
  userBookingController.createBooking,
);

// Endpoint mendapatkan booking dengan caching
router.get(
  '/users/:userId/bookings',
  userAuth,
  cacheMiddleware('user_bookings', 120),
  userBookingController.getUserBookings,
);

// Detail booking (GET)
router.get(
  '/bookings/:id/user',
  userAuth,
  cacheMiddleware('booking_detail', 120),
  userBookingController.getBookingById,
);

// Pembatalan booking (DELETE)
router.delete('/bookings/:id', userAuth, userBookingController.cancelBooking);

// ======== BRANCH ADMIN ROUTES ========
// Daftar booking di cabang
router.get(
  '/branches/:branchId/bookings',
  branchAdminAuth,
  cacheMiddleware('branch_bookings', 60),
  branchAdminBookingController.getBranchBookings,
);

// Detail booking di cabang
router.get(
  '/branches/:branchId/bookings/:id',
  branchAdminAuth,
  cacheMiddleware('branch_booking_detail', 60),
  branchAdminBookingController.getBranchBookingById,
);

// Update status booking
router.put(
  '/branches/:branchId/bookings/:id/status',
  branchAdminAuth,
  branchAdminBookingController.updateBranchBookingStatus,
);

// Buat booking manual
router.post(
  '/branches/:branchId/bookings/manual',
  branchAdminAuth,
  branchAdminBookingController.createManualBooking,
);

// ======== SUPER ADMIN ROUTES ========
// Daftar semua booking
router.get(
  '/admin/bookings',
  superAdminAuth,
  cacheMiddleware('admin_all_bookings', 120),
  superAdminBookingController.getAllBookings,
);

// Detail booking admin
router.get(
  '/admin/bookings/:id',
  superAdminAuth,
  cacheMiddleware('admin_booking_detail', 60),
  superAdminBookingController.getBookingById,
);

// Update pembayaran booking
router.put(
  '/admin/bookings/:id/payment',
  superAdminAuth,
  superAdminBookingController.updateBookingPayment,
);

// Hapus booking
router.delete(
  '/admin/bookings/:id',
  superAdminAuth,
  superAdminBookingController.deleteBooking,
);

// Statistik booking
router.get(
  '/admin/bookings/stats',
  superAdminAuth,
  cacheMiddleware('admin_booking_stats', 300),
  superAdminBookingController.getBookingStats,
);

// ======== OWNER ROUTES ========
// Laporan pendapatan
// contoh: http://localhost:3000/api/bookings/owner/reports/revenue?type=daily&startDate=2025-03-01&endDate=2025-03-07
router.get(
  '/owner/reports/revenue',
  ownerAuth,
  ownerBookingController.getRevenueReports,
);

// Laporan okupansi
router.get(
  '/owner/reports/occupancy',
  ownerAuth,
  ownerBookingController.getOccupancyReports,
);

// Laporan performa bisnis
router.get(
  '/owner/reports/performance',
  ownerAuth,
  ownerBookingController.getBusinessPerformance,
);

// Prediksi booking
router.get(
  '/owner/reports/forecast',
  ownerAuth,
  ownerBookingController.getBookingForecast,
);

export default router;
