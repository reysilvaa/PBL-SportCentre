// @ts-nocheck
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock configuration file
jest.mock('../../../../src/config/app/env', () => ({
  config: {
    port: 3000
  }
}));

// Mock console functions
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Save original process.env
const originalEnv = process.env;

// Import after mocking
import { getPort, getInstanceCount } from '../../../../src/config/app/port';

describe('Port Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env before each test
    process.env = { ...originalEnv };
    delete process.env.NODE_APP_INSTANCE;
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe('getPort', () => {
    it('should return base port when NODE_APP_INSTANCE is not defined', () => {
      // Make sure NODE_APP_INSTANCE is not defined
      delete process.env.NODE_APP_INSTANCE;
      
      const port = getPort();
      
      expect(port).toBe(3000);
    });

    it('should return incremented port when NODE_APP_INSTANCE is defined', () => {
      // Set NODE_APP_INSTANCE
      process.env.NODE_APP_INSTANCE = '2';
      
      const port = getPort();
      
      // Base port (3000) + instance index (2) = 3002
      expect(port).toBe(3002);
    });
  });

  describe('getInstanceCount', () => {
    it('should return 1 when NODE_APP_INSTANCE is not defined', () => {
      // Make sure NODE_APP_INSTANCE is not defined
      delete process.env.NODE_APP_INSTANCE;
      
      const count = getInstanceCount();
      
      expect(count).toBe(1);
    });

    it('should return instance count + 1 when NODE_APP_INSTANCE is defined', () => {
      // Set NODE_APP_INSTANCE
      process.env.NODE_APP_INSTANCE = '2';
      
      const count = getInstanceCount();
      
      // Instance index (2) + 1 = 3
      expect(count).toBe(3);
    });
  });
}); 