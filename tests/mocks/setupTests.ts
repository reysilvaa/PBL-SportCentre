import { jest } from '@jest/globals';

// Mock Redis and related services
jest.mock('../../src/config/services/redis', () => ({
  __esModule: true,
  NAMESPACE: {
    PREFIX: 'sportcenter',
    FIELDS: 'fields',
    USERS: 'users',
    BRANCHES: 'branches',
    BOOKINGS: 'bookings',
    PAYMENTS: 'payments',
    AUTH: 'auth',
    NOTIFICATION: 'notification',
    CLEANUP: 'cleanup-expired-bookings',
    AVAILABILITY: 'field-availability-updates'
  },
  KEYS: {
    TOKEN_BLACKLIST: 'sportcenter:auth:token_blacklist:',
    SOCKET: {
      ROOT: 'sportcenter',
      FIELDS: 'sportcenter/fields',
      NOTIFICATION: 'sportcenter/notification'
    },
    QUEUE: {
      CLEANUP: 'sportcenter:cleanup-expired-bookings',
      AVAILABILITY: 'sportcenter:field-availability-updates'
    },
    CACHE: {
      FIELD: 'sportcenter:fields:',
      BRANCH: 'sportcenter:branches:',
      USER: 'sportcenter:users:',
      BOOKING: 'sportcenter:bookings:',
      PAYMENT: 'sportcenter:payments:'
    }
  },
  ensureConnection: {
    exists: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn()
  },
  default: {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    isOpen: true
  }
}));

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn(),
    process: jest.fn(),
    getJobCounts: jest.fn().mockResolvedValue({ active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 }),
    name: 'mockQueue'
  }));
});

// Mock Node Redis
jest.mock('redis', () => {
  return {
    createClient: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(true),
      isOpen: true,
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn()
    }))
  };
});

// Mock Socket.IO
jest.mock('socket.io', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      of: jest.fn().mockReturnThis()
    }))
  };
});

// Global mocks for common utilities
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Add other global mocks as needed 