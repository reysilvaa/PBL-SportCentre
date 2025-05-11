import { Router } from 'express';
import * as bookingController from '../../controllers/booking.controller';
import { userAuth, branchAdminAuth, superAdminAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { bookingRateLimiter } from '../../middlewares/security.middleware';

const router = Router();

// Pembuatan booking
router.post('/', userAuth(), bookingRateLimiter, bookingController.createBooking);

// Mendapatkan booking pengguna berdasarkan userId
router.get(
  '/users/:userId/bookings',
  userAuth({
    ownerOnly: true,
    resourceName: 'user',
  }),
  cacheMiddleware('user_bookings', 120),
  bookingController.getUserBookings
);

// Detail booking berdasarkan ID
router.get(
  '/bookings/:id/user',
  userAuth({
    ownerOnly: true,
    resourceName: 'booking',
  }),
  cacheMiddleware('booking_detail', 120),
  bookingController.getBookingById
);

// Pembatalan booking
router.delete(
  '/bookings/:id',
  userAuth({
    ownerOnly: true,
    resourceName: 'booking',
  }),
  bookingController.cancelBooking
);

// Daftar booking di cabang
router.get(
  '/branches/:branchId/bookings',
  branchAdminAuth(),
  cacheMiddleware('branch_bookings', 60),
  bookingController.getBranchBookings
);

// Detail booking di cabang
router.get(
  '/branches/:branchId/bookings/:id',
  branchAdminAuth(),
  cacheMiddleware('branch_booking_detail', 60),
  bookingController.getBranchBookingById
);

// Update status booking
router.put('/branches/:branchId/bookings/:id/status', branchAdminAuth(), bookingController.updateBranchBookingStatus);

// Buat booking manual
router.post('/branches/:branchId/bookings/manual', branchAdminAuth(), bookingController.createManualBooking);

// Daftar semua booking (admin)
router.get(
  '/admin/bookings',
  superAdminAuth(),
  cacheMiddleware('admin_all_bookings', 120),
  bookingController.getAllBookings
);

// Detail booking admin
router.get(
  '/admin/bookings/:id',
  superAdminAuth(),
  cacheMiddleware('admin_booking_detail', 60),
  bookingController.getBookingById
);

// Update pembayaran booking
router.put('/admin/bookings/:id/payment', superAdminAuth(), bookingController.updateBookingPayment);

// Hapus booking
router.delete('/admin/bookings/:id', superAdminAuth(), bookingController.deleteBooking);

// Statistik booking
router.get(
  '/admin/bookings/stats',
  superAdminAuth(),
  cacheMiddleware('admin_booking_stats', 300),
  bookingController.getBookingStats
);

// Laporan pendapatan untuk owner
// router.get(
//   '/owner/reports/revenue',
//   ownerAuth(),
//   bookingController.getRevenueReports
// );

// // Laporan okupansi
// router.get(
//   '/owner/reports/occupancy',
//   ownerAuth(),
//   bookingController.getOccupancyReports
// );

// // Laporan performa bisnis
// router.get(
//   '/owner/reports/performance',
//   ownerAuth(),
//   bookingController.getBusinessPerformance
// );

// // Prediksi booking
// router.get(
//   '/owner/reports/forecast',
//   ownerAuth(),
//   bookingController.getBookingForecast
// );

export default router;
