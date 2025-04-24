import { Router } from 'express';
import * as userBookingController from '../../controllers/user/booking.controller';
import * as branchAdminBookingController from '../../controllers/admin/admin_cabang/booking.controller';
import * as superAdminBookingController from '../../controllers/admin/super_admin/booking.controller';
import * as ownerBookingController from '../../controllers/owner/booking.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleBasedController } from '../../middlewares/role.middleware';
import { cacheMiddleware } from '../../utils/cache.utils';
import { bookingRateLimiter } from '../../middlewares/security.middleware';

const router = Router();

// Pembuatan booking
router.post(
  '/',
  authMiddleware(['user']),
  bookingRateLimiter,
  roleBasedController({
    user: userBookingController.createBooking,
  })
);

// Mendapatkan booking pengguna berdasarkan userId
router.get(
  '/users/:userId/bookings',
  authMiddleware(['user']),
  cacheMiddleware('user_bookings', 120),
  roleBasedController({
    user: userBookingController.getUserBookings,
  })
);

// Detail booking berdasarkan ID
router.get(
  '/bookings/:id/user',
  authMiddleware(['user']),
  cacheMiddleware('booking_detail', 120),
  roleBasedController({
    user: userBookingController.getBookingById,
  })
);

// Pembatalan booking
router.delete(
  '/bookings/:id',
  authMiddleware(['user']),
  roleBasedController({
    user: userBookingController.cancelBooking,
  })
);

// Daftar booking di cabang
router.get(
  '/branches/:branchId/bookings',
  authMiddleware(['admin_cabang']),
  cacheMiddleware('branch_bookings', 60),
  roleBasedController({
    branchAdmin: branchAdminBookingController.getBranchBookings,
  })
);

// Detail booking di cabang
router.get(
  '/branches/:branchId/bookings/:id',
  authMiddleware(['admin_cabang']),
  cacheMiddleware('branch_booking_detail', 60),
  roleBasedController({
    branchAdmin: branchAdminBookingController.getBranchBookingById,
  })
);

// Update status booking
router.put(
  '/branches/:branchId/bookings/:id/status',
  authMiddleware(['admin_cabang']),
  roleBasedController({
    branchAdmin: branchAdminBookingController.updateBranchBookingStatus,
  })
);

// Buat booking manual
router.post(
  '/branches/:branchId/bookings/manual',
  authMiddleware(['admin_cabang']),
  roleBasedController({
    branchAdmin: branchAdminBookingController.createManualBooking,
  })
);

// Daftar semua booking (admin)
router.get(
  '/admin/bookings',
  authMiddleware(['super_admin']),
  cacheMiddleware('admin_all_bookings', 120),
  roleBasedController({
    superAdmin: superAdminBookingController.getAllBookings,
  })
);

// Detail booking admin
router.get(
  '/admin/bookings/:id',
  authMiddleware(['super_admin']),
  cacheMiddleware('admin_booking_detail', 60),
  roleBasedController({
    superAdmin: superAdminBookingController.getBookingById,
  })
);

// Update pembayaran booking
router.put(
  '/admin/bookings/:id/payment',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: superAdminBookingController.updateBookingPayment,
  })
);

// Hapus booking
router.delete(
  '/admin/bookings/:id',
  authMiddleware(['super_admin']),
  roleBasedController({
    superAdmin: superAdminBookingController.deleteBooking,
  })
);

// Statistik booking
router.get(
  '/admin/bookings/stats',
  authMiddleware(['super_admin']),
  cacheMiddleware('admin_booking_stats', 300),
  roleBasedController({
    superAdmin: superAdminBookingController.getBookingStats,
  })
);

// Laporan pendapatan untuk owner
router.get(
  '/owner/reports/revenue',
  authMiddleware(['owner_cabang']),
  roleBasedController({
    owner: ownerBookingController.getRevenueReports,
  })
);

// Laporan okupansi
router.get(
  '/owner/reports/occupancy',
  authMiddleware(['owner_cabang']),
  roleBasedController({
    owner: ownerBookingController.getOccupancyReports,
  })
);

// Laporan performa bisnis
router.get(
  '/owner/reports/performance',
  authMiddleware(['owner_cabang']),
  roleBasedController({
    owner: ownerBookingController.getBusinessPerformance,
  })
);

// Prediksi booking
router.get(
  '/owner/reports/forecast',
  authMiddleware(['owner_cabang']),
  roleBasedController({
    owner: ownerBookingController.getBookingForecast,
  })
);

export default router;
