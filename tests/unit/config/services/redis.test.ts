// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Redis client
const mockRedisClient = {
  isOpen: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  on: jest.fn(),
};

// Mock createClient
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient),
}));

// Mock console.error
console.error = jest.fn();

describe('Redis Service', () => {
  let redis;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Import the module
    redis = require('../../../../src/config/services/redis');
  });
  
  it('should export Redis client and utilities', () => {
    // Just check that the module exports the expected properties
    expect(redis).toBeDefined();
    expect(typeof redis.ensureConnection).toBe('object');
    expect(typeof redis.ensureConnection.get).toBe('function');
    expect(typeof redis.ensureConnection.set).toBe('function');
    expect(typeof redis.ensureConnection.del).toBe('function');
    expect(typeof redis.ensureConnection.exists).toBe('function');
  });
  
  it('should define Redis namespaces and keys', () => {
    expect(redis.NAMESPACE).toBeDefined();
    expect(redis.KEYS).toBeDefined();
    expect(typeof redis.NAMESPACE.PREFIX).toBe('string');
    expect(typeof redis.KEYS.TOKEN_BLACKLIST).toBe('string');
  });
}); 