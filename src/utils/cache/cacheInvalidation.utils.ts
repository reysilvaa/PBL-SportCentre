/**
 * Cache Invalidation Utilities
 * Modul ini menyediakan fungsi-fungsi untuk menginvalidasi cache secara konsisten
 * di seluruh aplikasi. Pola penamaan dan struktur harus diikuti oleh semua controller
 * untuk memastikan konsistensi.
 */

import { deleteCachedDataByPattern } from '../cache.utils';
import redisClient from '../../config/services/redis';

/**
 * Fungsi pembantu untuk menampilkan log invalidasi
 * @param entityName Nama entitas yang di-invalidasi
 * @param entityId ID entitas (opsional)
 */
const logInvalidation = (entityName: string, entityId?: number): void => {
  console.log(
    `[CACHE] Invalidating ${entityName} cache${entityId ? ` for ${entityName} #${entityId}` : ''}`,
  );
};

/**
 * Fungsi pembantu untuk menampilkan log kesuksesan
 * @param entityName Nama entitas yang di-invalidasi
 */
const logSuccess = (entityName: string): void => {
  console.log(`[CACHE] Successfully invalidated ${entityName} cache`);
};

/**
 * Fungsi pembantu untuk menampilkan log error
 * @param entityName Nama entitas yang gagal di-invalidasi
 * @param error Error yang terjadi
 */
const logError = (entityName: string, error: unknown): void => {
  console.error(`[CACHE ERROR] Failed to invalidate ${entityName} cache:`, error);
};

/**
 * Menghapus cache terkait bookings secara komprehensif
 * @param bookingId - ID booking spesifik (opsional)
 * @param fieldId - ID lapangan terkait (opsional)
 * @param branchId - ID cabang terkait (opsional)
 * @param userId - ID user terkait (opsional)
 */
export const invalidateBookingCache = async (
  bookingId?: number,
  fieldId?: number,
  branchId?: number,
  userId?: number,
): Promise<boolean> => {
  try {
    logInvalidation('booking', bookingId);

    // Hapus cache booking dan cachingnya
    await deleteCachedDataByPattern('booking');

    // Hapus cache field terkait
    if (fieldId) {
      await deleteCachedDataByPattern(`field:${fieldId}`);
    }
    await deleteCachedDataByPattern('fields_availability');

    // Hapus cache branch terkait
    if (branchId) {
      await deleteCachedDataByPattern(`branch:${branchId}:bookings`);
    }

    // Hapus cache user terkait
    if (userId) {
      await deleteCachedDataByPattern(`user:${userId}:bookings`);
    }

    // Hapus cache dashboard dan statistik
    await deleteCachedDataByPattern('dashboard');
    await deleteCachedDataByPattern('stats');

    logSuccess('booking');
    return true;
  } catch (error) {
    logError('booking', error);
    return false;
  }
};

/**
 * Menghapus cache terkait payment secara komprehensif
 * @param paymentId - ID payment spesifik (opsional)
 * @param bookingId - ID booking terkait (opsional)
 * @param fieldId - ID lapangan terkait (opsional)
 * @param branchId - ID cabang terkait (opsional)
 * @param userId - ID user terkait (opsional)
 */
export const invalidatePaymentCache = async (
  paymentId?: number,
  bookingId?: number,
  fieldId?: number,
  branchId?: number,
  userId?: number,
): Promise<boolean> => {
  try {
    logInvalidation('payment', paymentId);

    // Hapus cache payment
    await deleteCachedDataByPattern('payment');

    // Hapus cache booking terkait jika ada ID booking
    if (bookingId) {
      // Panggil dengan verbose=false untuk mengurangi log
      await invalidateBookingCache(bookingId, fieldId, branchId, userId);
    }

    // Hapus cache revenue
    await deleteCachedDataByPattern('revenue');

    logSuccess('payment');
    return true;
  } catch (error) {
    logError('payment', error);
    return false;
  }
};

/**
 * Menghapus cache terkait field secara komprehensif
 * @param fieldId - ID field spesifik (opsional)
 * @param branchId - ID cabang terkait (opsional)
 */
export const invalidateFieldCache = async (
  fieldId?: number,
  branchId?: number,
): Promise<boolean> => {
  try {
    logInvalidation('field', fieldId);

    // Hapus cache field dan ketersediaan
    await deleteCachedDataByPattern('field');
    await deleteCachedDataByPattern('fields_availability');

    // Hapus cache branch terkait
    if (branchId) {
      await deleteCachedDataByPattern(`branch:${branchId}:fields`);
    }

    logSuccess('field');
    return true;
  } catch (error) {
    logError('field', error);
    return false;
  }
};

/**
 * Menghapus cache terkait branch secara komprehensif
 * @param branchId - ID branch spesifik (opsional)
 */
export const invalidateBranchCache = async (branchId?: number): Promise<boolean> => {
  try {
    logInvalidation('branch', branchId);

    // Hapus cache branch
    await deleteCachedDataByPattern('branch');

    // Hapus cache spesifik jika ID disediakan
    if (branchId) {
      await deleteCachedDataByPattern(`branch:${branchId}`);
    }

    // Branch mempengaruhi fields dan ketersediaannya
    await invalidateFieldCache();

    // Dan dashboard
    await deleteCachedDataByPattern('dashboard');

    logSuccess('branch');
    return true;
  } catch (error) {
    logError('branch', error);
    return false;
  }
};

/**
 * Menghapus cache terkait user secara komprehensif
 * @param userId - ID user spesifik (opsional)
 */
export const invalidateUserCache = async (userId?: number): Promise<boolean> => {
  try {
    logInvalidation('user', userId);

    // Hapus cache user
    await deleteCachedDataByPattern('user');

    // Hapus cache spesifik jika ID disediakan
    if (userId) {
      await deleteCachedDataByPattern(`user:${userId}`);
    }

    logSuccess('user');
    return true;
  } catch (error) {
    logError('user', error);
    return false;
  }
};

/**
 * Menghapus cache terkait aktivitas log
 * @param userId - ID user terkait (opsional)
 */
export const invalidateActivityLogCache = async (userId?: number): Promise<boolean> => {
  try {
    logInvalidation('activity log');

    // Hapus cache activity log
    await deleteCachedDataByPattern('activity_logs');

    // Hapus cache user spesifik jika ID disediakan
    if (userId) {
      await deleteCachedDataByPattern(`user:${userId}:activities`);
    }

    logSuccess('activity log');
    return true;
  } catch (error) {
    logError('activity log', error);
    return false;
  }
};

/**
 * Menghapus cache terkait notifikasi
 * @param userId - ID user terkait (opsional)
 */
export const invalidateNotificationCache = async (userId?: number): Promise<boolean> => {
  try {
    logInvalidation('notification');

    // Hapus cache notifikasi
    await deleteCachedDataByPattern('notifications');

    // Hapus cache spesifik jika ID disediakan
    if (userId) {
      await deleteCachedDataByPattern(`user:${userId}:notifications`);
    }

    logSuccess('notification');
    return true;
  } catch (error) {
    logError('notification', error);
    return false;
  }
};

/**
 * Menghapus cache terkait tipe lapangan
 */
export const invalidateFieldTypeCache = async (): Promise<boolean> => {
  try {
    logInvalidation('field type');

    await deleteCachedDataByPattern('field_types');

    logSuccess('field type');
    return true;
  } catch (error) {
    logError('field type', error);
    return false;
  }
};

/**
 * Menghapus cache terkait promosi
 */
export const invalidatePromotionCache = async (): Promise<boolean> => {
  try {
    logInvalidation('promotion');

    await deleteCachedDataByPattern('promotions');

    logSuccess('promotion');
    return true;
  } catch (error) {
    logError('promotion', error);
    return false;
  }
};

/**
 * Menghapus cache terkait penggunaan promosi
 */
export const invalidatePromotionUsageCache = async (): Promise<boolean> => {
  try {
    logInvalidation('promotion usage');

    await deleteCachedDataByPattern('promotion_usage');

    logSuccess('promotion usage');
    return true;
  } catch (error) {
    logError('promotion usage', error);
    return false;
  }
};

/**
 * Menghapus cache terkait review lapangan
 */
export const invalidateFieldReviewCache = async (): Promise<boolean> => {
  try {
    logInvalidation('field review');

    await deleteCachedDataByPattern('field_reviews');

    logSuccess('field review');
    return true;
  } catch (error) {
    logError('field review', error);
    return false;
  }
};

/**
 * Menghapus semua cache sistem
 * Gunakan dengan hati-hati karena akan menyebabkan beban server tinggi
 * ketika harus meregenerasi semua cache
 */
export const invalidateAllCache = async (): Promise<boolean> => {
  try {
    console.log('[CACHE] Invalidating all system cache');

    // Lebih efisien menggunakan flushAll Redis daripada menghapus pattern
    await redisClient.flushAll();

    console.log('[CACHE] Successfully invalidated all system cache');
    return true;
  } catch (error) {
    console.error('[CACHE ERROR] Failed to invalidate all system cache:', error);
    return false;
  }
};
