import { jest } from '@jest/globals';

// Namespace dan key constants yang digunakan di Redis
export const NAMESPACE = {
  PREFIX: 'test',
  BOOKING: 'booking',
  NOTIFICATION: 'notification',
  CLEANUP: 'cleanup-expired-bookings',
  AVAILABILITY: 'field-availability-updates',
  AUTH: 'auth'
};

export const KEYS = {
  TOKEN_BLACKLIST: 'test:auth:token_blacklist:',
  SOCKET: {
    ROOT: 'test',
    FIELDS: 'test/fields',
    NOTIFICATION: 'test/notification'
  },
  QUEUE: {
    CLEANUP: 'test:cleanup-expired-bookings',
    AVAILABILITY: 'test:field-availability-updates'
  },
  CACHE: {
    FIELD: 'test:fields:',
    BRANCH: 'test:branches:',
    USER: 'test:users:',
    BOOKING: 'test:bookings:',
    PAYMENT: 'test:payments:'
  }
};

// Mock Redis client
export const redisClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  flushall: jest.fn().mockResolvedValue('OK'),
  keys: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  isOpen: true,
  on: jest.fn().mockImplementation((event, callback) => {
    // Simulasi event handler terdaftar
    if (event === 'ready') {
      // callback(); // Uncomment jika perlu menjalankan callback saat pengujian
    }
    return redisClient;
  }),
};

// Mock Redis connection
export const ensureConnection = {
  exists: jest.fn().mockResolvedValue(0),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  keys: jest.fn().mockResolvedValue([]),
};

// Mock Redis module
jest.mock('../../src/config/services/redis', () => ({
  redisClient,
  ensureConnection,
  NAMESPACE,
  KEYS,
  default: redisClient,
})); 