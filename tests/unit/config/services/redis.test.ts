// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock console functions
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Create mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  isOpen: true,
  exists: jest.fn().mockResolvedValue(1),
  setEx: jest.fn().mockResolvedValue('OK'),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue('{"test":"data"}'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue(['key1', 'key2']),
  on: jest.fn()
};

// Mock createClient function
const mockCreateClient = jest.fn().mockReturnValue(mockRedisClient);

// Mock 'redis' module before any imports
jest.mock('redis', () => ({
  createClient: mockCreateClient
}));

// Mock configuration file
jest.mock('../../../../src/config', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379',
      password: 'testpassword',
      ttl: 3600
    }
  }
}));

// Now we can import our redis module
const redisModule = jest.requireActual('../../../../src/config/services/redis');
const { KEYS, NAMESPACE } = redisModule;

describe('Redis Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Redis Constants', () => {
    it('should define correct namespaces', () => {
      expect(NAMESPACE.PREFIX).toBe('sportcenter');
      expect(NAMESPACE.FIELDS).toBe('fields');
      expect(NAMESPACE.USERS).toBe('users');
      expect(NAMESPACE.BRANCHES).toBe('branches');
      expect(NAMESPACE.BOOKINGS).toBe('bookings');
      expect(NAMESPACE.PAYMENTS).toBe('payments');
      expect(NAMESPACE.AUTH).toBe('auth');
      expect(NAMESPACE.NOTIFICATION).toBe('notification');
    });
    
    it('should define correct keys', () => {
      expect(KEYS.TOKEN_BLACKLIST).toContain('sportcenter:auth:token_blacklist:');
      
      expect(KEYS.SOCKET.ROOT).toBe('sportcenter');
      expect(KEYS.SOCKET.FIELDS).toBe('sportcenter/fields');
      expect(KEYS.SOCKET.NOTIFICATION).toBe('sportcenter/notification');
      
      expect(KEYS.QUEUE.CLEANUP).toContain('sportcenter:cleanup-expired-bookings');
      expect(KEYS.QUEUE.AVAILABILITY).toContain('sportcenter:field-availability-updates');
      
      expect(KEYS.CACHE.FIELD).toContain('sportcenter:fields:');
      expect(KEYS.CACHE.BRANCH).toContain('sportcenter:branches:');
      expect(KEYS.CACHE.USER).toContain('sportcenter:users:');
      expect(KEYS.CACHE.BOOKING).toContain('sportcenter:bookings:');
      expect(KEYS.CACHE.PAYMENT).toContain('sportcenter:payments:');
    });
  });
}); 