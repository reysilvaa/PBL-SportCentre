import { Router } from 'express';
import * as bookingController from '../../controllers/booking.controller';
import { userAuth, branchAdminAuth, superAdminAuth, ownerAuth } from '../../middlewares/auth.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { bookingRateLimiter } from '../../middlewares/security.middleware';

const router = Router();

// Pembuatan booking
router.post('/', userAuth(), bookingRateLimiter, bookingController.createBooking);

// Pembuatan booking oleh admin cabang (mirip booking user tapi untuk admin)
router.post('/admin', branchAdminAuth(), bookingController.createAdminBooking);

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
  '/:id/user',
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

// Endpoint untuk menandai pembayaran sebagai lunas
router.post('/payments/:paymentId/mark-paid', branchAdminAuth(), bookingController.markPaymentAsPaid);

// Endpoint untuk update status pembayaran
router.post('/payments/:paymentId/update-status', branchAdminAuth(), bookingController.updatePaymentStatus);

// admin membuat pelunasan dari pembayaran DP
router.post('/bookings/:bookingId/payment-completion', branchAdminAuth(), bookingController.createAdminPaymentCompletion);

// user membuat pelunasan dari pembayaran DP
router.post('/user/bookings/:bookingId/payment-completion', userAuth(), bookingController.createUserPaymentCompletion);

// Laporan pendapatan untuk owner
router.get(
  '/owner/reports/revenue',
  ownerAuth(),
  cacheMiddleware('owner_revenue_reports', 120),
  bookingController.getRevenueReports
);

// Laporan okupansi
router.get(
  '/owner/reports/occupancy',
  ownerAuth(),
  cacheMiddleware('owner_occupancy_reports', 120),
  bookingController.getOccupancyReports
);

// Laporan performa bisnis
router.get(
  '/owner/reports/performance',
  ownerAuth(),
  cacheMiddleware('owner_performance_reports', 240),
  bookingController.getBusinessPerformance
);

// Prediksi booking
router.get(
  '/owner/reports/forecast',
  ownerAuth(),
  cacheMiddleware('owner_booking_forecast', 240),
  bookingController.getBookingForecast
);

export default router;
