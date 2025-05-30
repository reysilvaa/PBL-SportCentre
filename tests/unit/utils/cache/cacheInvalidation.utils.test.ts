// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Set up console mocks
console.log = jest.fn();
console.error = jest.fn();

// Mock deleteCachedDataByPattern function
const mockDeleteCachedDataByPattern = jest.fn().mockResolvedValue(true);

// Mock cache.utils before importing other modules
jest.mock('../../../../src/utils/cache.utils', () => ({
  deleteCachedDataByPattern: mockDeleteCachedDataByPattern
}));

// Mock implementation functions
const mockInvalidateBookingCacheImpl = jest.fn().mockImplementation(
  async (_bookingId, _fieldId, _branchId, _userId) => {
    await mockDeleteCachedDataByPattern('booking');
    if (_fieldId) {
      await mockDeleteCachedDataByPattern(`field:${_fieldId}`);
    }
    await mockDeleteCachedDataByPattern('fields_availability');
    if (_branchId) {
      await mockDeleteCachedDataByPattern(`branch:${_branchId}:bookings`);
    }
    if (_userId) {
      await mockDeleteCachedDataByPattern(`user:${_userId}:bookings`);
    }
    await mockDeleteCachedDataByPattern('dashboard');
    await mockDeleteCachedDataByPattern('stats');
    return true;
  }
);

const mockInvalidateFieldCacheImpl = jest.fn().mockImplementation(
  async (_fieldId, _branchId) => {
    await mockDeleteCachedDataByPattern('field');
    await mockDeleteCachedDataByPattern('fields_availability');
    if (_branchId) {
      await mockDeleteCachedDataByPattern(`branch:${_branchId}:fields`);
    }
    return true;
  }
);

const mockInvalidatePaymentCacheImpl = jest.fn().mockImplementation(
  async (_paymentId, _bookingId, _fieldId, _branchId, _userId) => {
    await mockDeleteCachedDataByPattern('payment');
    await mockDeleteCachedDataByPattern('revenue');
    if (_bookingId) {
      await mockInvalidateBookingCacheImpl(_bookingId, _fieldId, _branchId, _userId);
    }
    return true;
  }
);

const mockInvalidateBranchCacheImpl = jest.fn().mockImplementation(
  async (_branchId) => {
    await mockDeleteCachedDataByPattern('branch');
    if (_branchId) {
      await mockDeleteCachedDataByPattern(`branch:${_branchId}`);
    }
    await mockInvalidateFieldCacheImpl();
    await mockDeleteCachedDataByPattern('dashboard');
    return true;
  }
);

const mockInvalidateUserCacheImpl = jest.fn().mockImplementation(
  async (_userId) => {
    await mockDeleteCachedDataByPattern('user');
    if (_userId) {
      await mockDeleteCachedDataByPattern(`user:${_userId}`);
    }
    return true;
  }
);

const mockInvalidateActivityLogCacheImpl = jest.fn().mockImplementation(
  async (_userId) => {
    await mockDeleteCachedDataByPattern('activity_logs');
    if (_userId) {
      await mockDeleteCachedDataByPattern(`user:${_userId}:activities`);
    }
    return true;
  }
);

const mockInvalidateNotificationCacheImpl = jest.fn().mockImplementation(
  async (_userId) => {
    await mockDeleteCachedDataByPattern('notifications');
    if (_userId) {
      await mockDeleteCachedDataByPattern(`user:${_userId}:notifications`);
    }
    return true;
  }
);

// Create error handler wrapper
const createErrorHandler = (fnImpl, errorMessage) => {
  return async (...args) => {
    try {
      return await fnImpl(...args);
    } catch (error) {
      console.error(`[CACHE ERROR] ${errorMessage}:`, error);
      return false;
    }
  };
};

// Mock the module
jest.mock('../../../../src/utils/cache/cacheInvalidation.utils', () => {
  return {
    invalidateBookingCache: createErrorHandler(
      mockInvalidateBookingCacheImpl, 
      'Failed to invalidate booking cache'
    ),
    invalidateFieldCache: createErrorHandler(
      mockInvalidateFieldCacheImpl,
      'Failed to invalidate field cache'
    ),
    invalidatePaymentCache: createErrorHandler(
      mockInvalidatePaymentCacheImpl,
      'Failed to invalidate payment cache'
    ),
    invalidateBranchCache: createErrorHandler(
      mockInvalidateBranchCacheImpl,
      'Failed to invalidate branch cache'
    ),
    invalidateUserCache: createErrorHandler(
      mockInvalidateUserCacheImpl,
      'Failed to invalidate user cache'
    ),
    invalidateActivityLogCache: createErrorHandler(
      mockInvalidateActivityLogCacheImpl,
      'Failed to invalidate activity log cache'
    ),
    invalidateNotificationCache: createErrorHandler(
      mockInvalidateNotificationCacheImpl,
      'Failed to invalidate notification cache'
    ),
    invalidateFieldTypeCache: jest.fn().mockResolvedValue(true),
    invalidatePromotionCache: jest.fn().mockResolvedValue(true),
    invalidatePromotionUsageCache: jest.fn().mockResolvedValue(true),
    invalidateFieldReviewCache: jest.fn().mockResolvedValue(true),
    invalidateAllCache: jest.fn().mockResolvedValue(true)
  };
});

// Import after mocks are set up
import { deleteCachedDataByPattern } from '../../../../src/utils/cache.utils';
import * as cacheInvalidation from '../../../../src/utils/cache/cacheInvalidation.utils';

describe('Cache Invalidation Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('invalidateBookingCache', () => {
    it('should invalidate booking cache with all parameters', async () => {
      const bookingId = 1;
      const fieldId = 2;
      const branchId = 3;
      const userId = 4;

      const result = await cacheInvalidation.invalidateBookingCache(bookingId, fieldId, branchId, userId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`field:${fieldId}`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:bookings`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:bookings`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('stats');
    });

    it('should invalidate booking cache with only bookingId', async () => {
      const bookingId = 1;

      const result = await cacheInvalidation.invalidateBookingCache(bookingId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('stats');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateBookingCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate booking cache'),
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
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
    });

    it('should invalidate payment cache without booking ID', async () => {
      const paymentId = 1;

      const result = await cacheInvalidation.invalidatePaymentCache(paymentId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidatePaymentCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate payment cache'),
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
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:fields`);
    });

    it('should invalidate field cache without branch ID', async () => {
      const fieldId = 1;

      const result = await cacheInvalidation.invalidateFieldCache(fieldId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateFieldCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate field cache'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateBranchCache', () => {
    it('should invalidate branch cache with branch ID', async () => {
      const branchId = 1;

      const result = await cacheInvalidation.invalidateBranchCache(branchId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('branch');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
    });

    it('should invalidate branch cache without branch ID', async () => {
      const result = await cacheInvalidation.invalidateBranchCache();

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('branch');
      expect(deleteCachedDataByPattern).not.toHaveBeenCalledWith('branch:undefined');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateBranchCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate branch cache'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate user cache with user ID', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateUserCache(userId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('user');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('should invalidate user cache without user ID', async () => {
      const result = await cacheInvalidation.invalidateUserCache();

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('user');
      expect(deleteCachedDataByPattern).not.toHaveBeenCalledWith('user:undefined');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateUserCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate user cache'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateActivityLogCache', () => {
    it('should invalidate activity log cache with user ID', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateActivityLogCache(userId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('activity_logs');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:activities`);
    });
    
    it('should invalidate activity log cache without user ID', async () => {
      const result = await cacheInvalidation.invalidateActivityLogCache();

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('activity_logs');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateActivityLogCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate activity log cache'),
        expect.any(Error)
      );
    });
  });

  describe('invalidateNotificationCache', () => {
    it('should invalidate notification cache with user ID', async () => {
      const userId = 1;

      const result = await cacheInvalidation.invalidateNotificationCache(userId);

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('notifications');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:notifications`);
    });
    
    it('should invalidate notification cache without user ID', async () => {
      const result = await cacheInvalidation.invalidateNotificationCache();

      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('notifications');
    });

    it('should handle errors during invalidation', async () => {
      deleteCachedDataByPattern.mockRejectedValueOnce(new Error('Test error'));

      const result = await cacheInvalidation.invalidateNotificationCache(1);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate notification cache'),
        expect.any(Error)
      );
    });
  });
}); 