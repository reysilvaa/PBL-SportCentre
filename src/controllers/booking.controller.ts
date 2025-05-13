// Re-export fungsi-fungsi dari controller terpisah
import * as UserBookingController from './booking/user-booking.controller';
import * as AdminBookingController from './booking/admin-booking.controller';
import * as SuperAdminBookingController from './booking/super-admin-booking.controller';
import * as OwnerBookingController from './booking/owner-booking.controller';

/**
 * Booking Controller (Simplified)
 * File ini hanya re-export fungsi dari file controller terpisah
 * untuk menjaga backward compatibility dengan route yang sudah ada
 */

// Export User Operations
export const createBooking = UserBookingController.createBooking;
export const getUserBookings = UserBookingController.getUserBookings;
export const getBookingById = UserBookingController.getBookingById;
export const cancelBooking = UserBookingController.cancelBooking;

// Export Branch Admin Operations
export const getBranchBookings = AdminBookingController.getBranchBookings;
export const getBranchBookingById = AdminBookingController.getBranchBookingById;
export const updateBranchBookingStatus = AdminBookingController.updateBranchBookingStatus;
export const createManualBooking = AdminBookingController.createManualBooking;

// Export Super Admin Operations
export const getAllBookings = SuperAdminBookingController.getAllBookings;
export const updateBookingPayment = SuperAdminBookingController.updateBookingPayment;
export const deleteBooking = SuperAdminBookingController.deleteBooking;
export const getBookingStats = SuperAdminBookingController.getBookingStats;

// Export Owner Operations
export const getRevenueReports = OwnerBookingController.getRevenueReports;
export const getOccupancyReports = OwnerBookingController.getOccupancyReports;
export const getBusinessPerformance = OwnerBookingController.getBusinessPerformance;
export const getBookingForecast = OwnerBookingController.getBookingForecast;
