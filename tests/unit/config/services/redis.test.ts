// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Redis client
const mockRedisClient = {
  isOpen: false,
  connect: jest.fn().mockImplementation(() => {
    mockRedisClient.isOpen = true;
    return Promise.resolve(mockRedisClient);
  }),
  disconnect: jest.fn().mockImplementation(() => {
    mockRedisClient.isOpen = false;
    return Promise.resolve();
  }),
  set: jest.fn().mockResolvedValue('OK'),
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  keys: jest.fn().mockResolvedValue([]),
  on: jest.fn(),
};

// Mock createClient
const mockCreateClient = jest.fn().mockReturnValue(mockRedisClient);

// Mock redis
jest.mock('redis', () => ({
  createClient: mockCreateClient,
}));

// Mock config
jest.mock('../../../../src/config/app/env', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379',
      password: '',
      ttl: 3600,
    },
  },
}));

// Mock console methods
jest.spyOn(console, 'info').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();
jest.spyOn(console, 'log').mockImplementation();

describe('Redis Service', () => {
  let redisModule;
  let ensureConnection;
  let NAMESPACE;
  let KEYS;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the module registry for this test
    jest.resetModules();
    
    // Import the module under test
    redisModule = require('../../../../src/config/services/redis');
    ensureConnection = redisModule.ensureConnection;
    NAMESPACE = redisModule.NAMESPACE;
    KEYS = redisModule.KEYS;
  });
  
  describe('Initialization', () => {
    it('should define namespaces and keys correctly', () => {
      expect(NAMESPACE).toBeDefined();
      expect(NAMESPACE.PREFIX).toBe('sportcenter');
      expect(NAMESPACE.FIELDS).toBe('fields');
      expect(NAMESPACE.USERS).toBe('users');
      
      expect(KEYS).toBeDefined();
      expect(KEYS.TOKEN_BLACKLIST).toContain('sportcenter:auth:token_blacklist:');
      expect(KEYS.CACHE.FIELD).toContain('sportcenter:fields:');
    });
  });
  
  describe('ensureConnection', () => {
    it('should ensure connection before get operation', async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.get.mockResolvedValueOnce('test-value');
      
      const result = await ensureConnection.get('test-key');
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
    });
    
    it('should ensure connection before set operation', async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.set.mockResolvedValueOnce('OK');
      
      const result = await ensureConnection.set('test-key', 'test-value');
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(result).toBe('OK');
    });
    
    it('should ensure connection before del operation', async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.del.mockResolvedValueOnce(1);
      
      const result = await ensureConnection.del('test-key');
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1);
    });
    
    it('should ensure connection before exists operation', async () => {
      mockRedisClient.isOpen = false;
      mockRedisClient.exists.mockResolvedValueOnce(1);
      
      const result = await ensureConnection.exists('test-key');
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1);
    });
    
    it('should handle errors in get operation', async () => {
      const error = new Error('Redis error');
      mockRedisClient.get.mockRejectedValueOnce(error);
      
      const result = await ensureConnection.get('test-key');
      
      expect(console.error).toHaveBeenCalledWith('Redis get error:', error);
      expect(result).toBeNull();
    });
    
    it('should handle errors in set operation', async () => {
      const error = new Error('Redis error');
      mockRedisClient.set.mockRejectedValueOnce(error);
      
      const result = await ensureConnection.set('test-key', 'test-value');
      
      expect(console.error).toHaveBeenCalledWith('Redis set error:', error);
      expect(result).toBeNull();
    });
    
    it('should handle errors in del operation', async () => {
      const error = new Error('Redis error');
      mockRedisClient.del.mockRejectedValueOnce(error);
      
      const result = await ensureConnection.del('test-key');
      
      expect(console.error).toHaveBeenCalledWith('Redis del error:', error);
      expect(result).toBe(0);
    });
    
    it('should handle errors in exists operation', async () => {
      const error = new Error('Redis error');
      mockRedisClient.exists.mockRejectedValueOnce(error);
      
      const result = await ensureConnection.exists('test-key');
      
      expect(console.error).toHaveBeenCalledWith('Redis exists error:', error);
      expect(result).toBe(0);
    });
  });
}); 