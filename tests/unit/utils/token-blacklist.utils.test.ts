// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Redis client
jest.mock('../../../src/config/services/redis', () => {
  return {
    ensureConnection: {
      setEx: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue([0, []]),
      keys: jest.fn().mockResolvedValue([]),
    },
    NAMESPACE: {
      AUTH: 'auth'
    }
  };
});

// Import after mocking
import { ensureConnection } from '../../../src/config/services/redis';
import {
  blacklistToken,
  isTokenBlacklisted,
  removeFromBlacklist,
  clearBlacklist,
  getBlacklistSize,
  blacklistTokens,
} from '../../../src/utils/token-blacklist.utils';

describe('Token Blacklist Utils', () => {
  const testToken = 'test-jwt-token';
  const blacklistPrefix = 'token_blacklist:';
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('blacklistToken', () => {
    it('should add a token to the blacklist with default expiry', async () => {
      await blacklistToken(testToken);
      
      expect(ensureConnection.setEx).toHaveBeenCalledWith(
        `${blacklistPrefix}${testToken}`,
        24 * 60 * 60, // Default TTL: 24 hours
        '1'
      );
    });
    
    it('should add a token to the blacklist with custom expiry', async () => {
      const customTTL = 3600; // 1 hour
      await blacklistToken(testToken, customTTL);
      
      expect(ensureConnection.setEx).toHaveBeenCalledWith(
        `${blacklistPrefix}${testToken}`,
        customTTL,
        '1'
      );
    });
    
    it('should handle errors when adding to blacklist', async () => {
      const error = new Error('Redis error');
      ensureConnection.setEx.mockRejectedValueOnce(error);
      
      await blacklistToken(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error blacklisting token:', error);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true when token is in blacklist', async () => {
      ensureConnection.exists.mockResolvedValueOnce(1);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(ensureConnection.exists).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(true);
    });
    
    it('should return false when token is not in blacklist', async () => {
      ensureConnection.exists.mockResolvedValueOnce(0);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(ensureConnection.exists).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(false);
    });
    
    it('should handle errors when checking blacklist', async () => {
      const error = new Error('Redis error');
      ensureConnection.exists.mockRejectedValueOnce(error);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error checking blacklisted token:', error);
      expect(result).toBe(false);
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove a token from the blacklist successfully', async () => {
      ensureConnection.del.mockResolvedValueOnce(1);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(ensureConnection.del).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(true);
    });
    
    it('should return false when token is not found in blacklist', async () => {
      ensureConnection.del.mockResolvedValueOnce(0);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(ensureConnection.del).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(false);
    });
    
    it('should handle errors when removing from blacklist', async () => {
      const error = new Error('Redis error');
      ensureConnection.del.mockRejectedValueOnce(error);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error removing token from blacklist:', error);
      expect(result).toBe(false);
    });
  });

  describe('clearBlacklist', () => {
    it('should clear all tokens from the blacklist', async () => {
      // Mock the keys to return some tokens
      ensureConnection.keys
        .mockResolvedValueOnce(['token_blacklist:token1', 'token_blacklist:token2']);
      
      await clearBlacklist();
      
      expect(ensureConnection.keys).toHaveBeenCalledWith(`${blacklistPrefix}*`);
      expect(ensureConnection.del).toHaveBeenCalledTimes(2);
    });
    
    it('should handle multiple tokens when clearing blacklist', async () => {
      // Mock keys to return multiple tokens
      ensureConnection.keys
        .mockResolvedValueOnce(['token_blacklist:token1', 'token_blacklist:token2', 'token_blacklist:token3']);
      
      await clearBlacklist();
      
      expect(ensureConnection.keys).toHaveBeenCalledWith(`${blacklistPrefix}*`);
      expect(ensureConnection.del).toHaveBeenCalledTimes(3);
    });
    
    it('should do nothing when no keys are found', async () => {
      ensureConnection.keys.mockResolvedValueOnce([]);
      
      await clearBlacklist();
      
      expect(ensureConnection.keys).toHaveBeenCalledWith(`${blacklistPrefix}*`);
      expect(ensureConnection.del).not.toHaveBeenCalled();
    });
    
    it('should handle errors when clearing blacklist', async () => {
      const error = new Error('Redis error');
      ensureConnection.keys.mockRejectedValueOnce(error);
      
      await clearBlacklist();
      
      expect(console.error).toHaveBeenCalledWith('Error clearing blacklist:', error);
    });
  });

  describe('getBlacklistSize', () => {
    it('should return the number of tokens in the blacklist', async () => {
      ensureConnection.keys.mockResolvedValueOnce(['token_blacklist:token1', 'token_blacklist:token2']);
      
      const result = await getBlacklistSize();
      
      expect(ensureConnection.keys).toHaveBeenCalledWith(`${blacklistPrefix}*`);
      expect(result).toBe(2);
    });
    
    it('should handle multiple batches when counting tokens', async () => {
      ensureConnection.keys.mockResolvedValueOnce(['token_blacklist:token1', 'token_blacklist:token2', 'token_blacklist:token3']);
      
      const result = await getBlacklistSize();
      
      expect(ensureConnection.keys).toHaveBeenCalledWith(`${blacklistPrefix}*`);
      expect(result).toBe(3);
    });
    
    it('should return 0 when no tokens are found', async () => {
      ensureConnection.keys.mockResolvedValueOnce([]);
      
      const result = await getBlacklistSize();
      
      expect(result).toBe(0);
    });
    
    it('should handle errors when getting blacklist size', async () => {
      const error = new Error('Redis error');
      ensureConnection.keys.mockRejectedValueOnce(error);
      
      const result = await getBlacklistSize();
      
      expect(console.error).toHaveBeenCalledWith('Error getting blacklist size:', error);
      expect(result).toBe(0);
    });
  });

  describe('blacklistTokens', () => {
    it('should add multiple tokens to the blacklist', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      
      await blacklistTokens(tokens);
      
      expect(ensureConnection.setEx).toHaveBeenCalledTimes(3);
    });
    
    it('should use custom expiry when provided', async () => {
      const tokens = ['token1', 'token2'];
      const customTTL = 3600;
      
      await blacklistTokens(tokens, customTTL);
      
      expect(ensureConnection.setEx).toHaveBeenCalledTimes(2);
      expect(ensureConnection.setEx).toHaveBeenCalledWith(
        expect.stringContaining('token1'),
        customTTL,
        '1'
      );
    });
    
    it('should handle errors when batch blacklisting tokens', async () => {
      const tokens = ['token1', 'token2'];
      const error = new Error('Redis error');
      
      ensureConnection.setEx.mockRejectedValueOnce(error);
      
      await blacklistTokens(tokens);
      
      expect(console.error).toHaveBeenCalledWith('Error blacklisting multiple tokens:', error);
    });
  });
}); 