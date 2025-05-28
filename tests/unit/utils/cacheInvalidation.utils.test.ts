// @ts-nocheck
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { unitTestSetup } from '../../core';
import {
  invalidateBookingCache,
  invalidatePaymentCache,
  invalidateFieldCache,
  invalidateBranchCache,
  invalidateUserCache,
  invalidateAllCache
} from '../../../src/utils/cache/cacheInvalidation.utils';

// Setup pengujian unit untuk utils
unitTestSetup.setupUtilsTest();

// Mock cache utilities
jest.mock('../../../src/utils/cache.utils', () => ({
  deleteCachedDataByPattern: jest.fn().mockResolvedValue(true)
}));

// Mock redis client
jest.mock('../../../src/config/services/redis', () => ({
  __esModule: true,
  default: {
    keys: jest.fn().mockResolvedValue(['test:key1', 'test:key2']),
    del: jest.fn().mockResolvedValue(2)
  }
}));

// Import mocked functions
import { deleteCachedDataByPattern } from '../../../src/utils/cache.utils';

describe('Cache Invalidation Utils', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Mock console methods to avoid logs in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });
  
  describe('invalidateBookingCache', () => {
    it('seharusnya menghapus semua cache booking tanpa parameter', async () => {
      const result = await invalidateBookingCache();
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('stats');
    });
    
    it('seharusnya menghapus cache booking spesifik dengan ID', async () => {
      const bookingId = 123;
      const fieldId = 456;
      const branchId = 789;
      const userId = 101;
      
      const result = await invalidateBookingCache(bookingId, fieldId, branchId, userId);
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`field:${fieldId}`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:bookings`);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}:bookings`);
    });
    
    it('seharusnya mengembalikan false jika terjadi error', async () => {
      // Mock error
      (deleteCachedDataByPattern as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      
      const result = await invalidateBookingCache();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('invalidatePaymentCache', () => {
    it('seharusnya menghapus cache payment tanpa parameter', async () => {
      const result = await invalidatePaymentCache();
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
    });
    
    it('seharusnya menghapus cache payment dan booking terkait', async () => {
      const paymentId = 123;
      const bookingId = 456;
      
      const result = await invalidatePaymentCache(paymentId, bookingId);
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('payment');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('booking');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('revenue');
    });
  });
  
  describe('invalidateFieldCache', () => {
    it('seharusnya menghapus cache field tanpa parameter', async () => {
      const result = await invalidateFieldCache();
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('fields_availability');
    });
    
    it('seharusnya menghapus cache field dengan branch terkait', async () => {
      const fieldId = 123;
      const branchId = 456;
      
      const result = await invalidateFieldCache(fieldId, branchId);
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}:fields`);
    });
  });
  
  describe('invalidateBranchCache', () => {
    it('seharusnya menghapus cache branch dan field terkait', async () => {
      const result = await invalidateBranchCache();
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('branch');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('field');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('dashboard');
    });
    
    it('seharusnya menghapus cache branch spesifik dengan ID', async () => {
      const branchId = 123;
      
      const result = await invalidateBranchCache(branchId);
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('branch');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`branch:${branchId}`);
    });
  });
  
  describe('invalidateUserCache', () => {
    it('seharusnya menghapus semua cache user tanpa parameter', async () => {
      const result = await invalidateUserCache();
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('user');
    });
    
    it('seharusnya menghapus cache user spesifik dengan ID', async () => {
      const userId = 123;
      
      const result = await invalidateUserCache(userId);
      
      expect(result).toBe(true);
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('user');
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith(`user:${userId}`);
    });
  });
  
  describe('invalidateAllCache', () => {
    it('seharusnya menghapus semua cache di sistem', async () => {
      // Mock implementation untuk invalidateAllCache yang mengembalikan true
      (deleteCachedDataByPattern as jest.Mock).mockResolvedValue(true);
      
      const result = await invalidateAllCache();
      
      expect(result).toBe(true);
      // Cek bahwa semua invalidasi cache utama dipanggil
      expect(deleteCachedDataByPattern).toHaveBeenCalledWith('*');
    });
  });
}); 