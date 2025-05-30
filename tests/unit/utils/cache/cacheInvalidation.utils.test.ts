// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Set up console mocks
console.log = jest.fn();
console.error = jest.fn();

// Create a mock for deleteCachedDataByPattern that tracks calls
const mockDeleteCachedDataByPattern = jest.fn().mockResolvedValue(true);

// Mock cache.utils
jest.mock('../../../../src/utils/cache.utils', () => ({
  deleteCachedDataByPattern: mockDeleteCachedDataByPattern
}));

// Import the real implementation after setting up mocks
import * as cacheInvalidation from '../../../../src/utils/cache/cacheInvalidation.utils';

describe('Cache Invalidation Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidateBookingCache', () => {
    it('should invalidate booking cache with all parameters', async () => {
      const bookingId = 1;
      const fieldId = 2;
      const branchId = 3;
      const userId = 4;

      const result = await cacheInvalidation.invalidateBookingCache(bookingId, fieldId, branchId, userId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`field:${fieldId}`);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:bookings`);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:bookings`);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('stats');
    });

    it('should invalidate booking cache with only bookingId', async () => {
      const bookingId = 1;

      const result = await cacheInvalidation.invalidateBookingCache(bookingId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('stats');
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateBookingCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate booking cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidatePaymentCache', () => {
    it('should invalidate payment cache with all parameters', async () => {
      const paymentId = 1;
      const bookingId = 2;
      const fieldId = 3;
      const branchId = 4;
      const userId = 5;

      const result = await cacheInvalidation.invalidatePaymentCache(paymentId, bookingId, fieldId, branchId, userId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
      // The invalidateBookingCache function is called internally and will call deleteCachedDataByPattern
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      // Check a few key calls that should happen due to invalidateBookingCache being called
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`field:${fieldId}`);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:bookings`);
    });

    it('should invalidate payment cache without booking ID', async () => {
      const paymentId = 1;

      const result = await cacheInvalidation.invalidatePaymentCache(paymentId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
      // Should not call invalidateBookingCache
      expect(mockDeleteCachedDataByPattern).not.toHaveBeenCalledWith('booking');
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidatePaymentCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate payment cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateFieldCache', () => {
    it('should invalidate field cache with all parameters', async () => {
      const fieldId = 1;
      const branchId = 2;

      const result = await cacheInvalidation.invalidateFieldCache(fieldId, branchId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:fields`);
    });

    it('should invalidate field cache without branchId', async () => {
      const fieldId = 1;

      const result = await cacheInvalidation.invalidateFieldCache(fieldId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateFieldCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate field cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateBranchCache', () => {
    it('should invalidate branch cache with branchId', async () => {
      const branchId = 1;

      const result = await cacheInvalidation.invalidateBranchCache(branchId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('branch');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}`);
      // invalidateFieldCache is called internally
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateBranchCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate branch cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate user cache with userId', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateUserCache(userId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('user');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateUserCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate user cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateActivityLogCache', () => {
    it('should invalidate activity log cache with userId', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateActivityLogCache(userId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('activity_logs');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:activities`);
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateActivityLogCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate activity log cache:'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateNotificationCache', () => {
    it('should invalidate notification cache with userId', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateNotificationCache(userId);

      expect(result).toBe(true);
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith('notifications');
      expect(mockDeleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:notifications`);
    });

    it('should handle errors during invalidation', async () => {
      mockDeleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateNotificationCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE ERROR] Failed to invalidate notification cache:'),
        expect.any(Error)
      );
    });
  });
}); 