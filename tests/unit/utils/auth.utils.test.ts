import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as authUtils from '../../../src/utils/auth.utils';

// Mock Redis
jest.mock('../../../src/config/services/redis', () => ({
  ensureConnection: {
    setEx: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
  },
  KEYS: {
    TOKEN_BLACKLIST: 'test:auth:token_blacklist:'
  }
}));

// Mock config
jest.mock('../../../src/config/app/env', () => ({
  config: {
    cookies: {
      maxAge: 3600000, // 1 jam
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    }
  }
}));

describe('Auth Utils', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock request
    mockReq = {
      cookies: {
        auth_token: 'test-auth-token',
        is_logged_in: 'true'
      },
      signedCookies: {
        auth_token: 'signed-test-auth-token',
        refresh_token: 'signed-refresh-token'
      }
    };

    // Setup mock response
    mockRes = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
  });

  describe('Cookie Management', () => {
    it('setCookie should set cookie with default options', () => {
      // Act
      authUtils.setCookie(mockRes as Response, 'test_cookie', 'test_value');

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledWith('test_cookie', 'test_value', expect.objectContaining({
        maxAge: 3600000,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
      }));
    });

    it('setCookie should set cookie with custom options', () => {
      // Act
      authUtils.setCookie(mockRes as Response, 'test_cookie', 'test_value', {
        maxAge: 7200000,
        httpOnly: false,
        secure: true,
        sameSite: 'strict'
      });

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledWith('test_cookie', 'test_value', expect.objectContaining({
        maxAge: 7200000,
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        path: '/'
      }));
    });

    it('getCookie should return cookie from request', () => {
      // Act
      const cookie = authUtils.getCookie(mockReq as Request, 'auth_token');

      // Assert
      expect(cookie).toBe('test-auth-token');
    });

    it('getCookie should return signed cookie when signed=true', () => {
      // Act
      const cookie = authUtils.getCookie(mockReq as Request, 'auth_token', true);

      // Assert
      expect(cookie).toBe('signed-test-auth-token');
    });

    it('clearCookie should clear cookie with default options', () => {
      // Act
      authUtils.clearCookie(mockRes as Response, 'auth_token');

      // Assert
      expect(mockRes.clearCookie).toHaveBeenCalledWith('auth_token', expect.objectContaining({
        path: '/',
        secure: false,
        sameSite: 'lax',
        expires: expect.any(Date)
      }));
    });
  });

  describe('Token Management', () => {
    it('setAuthCookie should set auth_token and is_logged_in cookies', () => {
      // Act
      authUtils.setAuthCookie(mockRes as Response, 'new-auth-token');

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenNthCalledWith(1, 'auth_token', 'new-auth-token', expect.objectContaining({
        httpOnly: true,
        signed: true
      }));
      expect(mockRes.cookie).toHaveBeenNthCalledWith(2, 'is_logged_in', 'true', expect.objectContaining({
        httpOnly: false,
        signed: false
      }));
    });

    it('getAuthToken should return auth token from cookies', () => {
      // Act
      const token = authUtils.getAuthToken(mockReq as Request);

      // Assert
      expect(token).toBe('signed-test-auth-token');
    });

    it('clearAuthCookie should clear auth_token and is_logged_in cookies', () => {
      // Act
      authUtils.clearAuthCookie(mockRes as Response);

      // Assert
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes.clearCookie).toHaveBeenNthCalledWith(1, 'auth_token', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenNthCalledWith(2, 'is_logged_in', expect.any(Object));
    });

    it('setRefreshTokenCookie should set refresh_token and is_logged_in cookies', () => {
      // Act
      authUtils.setRefreshTokenCookie(mockRes as Response, 'new-refresh-token');

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenNthCalledWith(1, 'refresh_token', 'new-refresh-token', expect.objectContaining({
        httpOnly: true,
        signed: true
      }));
      expect(mockRes.cookie).toHaveBeenNthCalledWith(2, 'is_logged_in', 'true', expect.objectContaining({
        httpOnly: false,
        signed: false
      }));
    });

    it('getRefreshToken should return refresh token from cookies', () => {
      // Act
      const token = authUtils.getRefreshToken(mockReq as Request);

      // Assert
      expect(token).toBe('signed-refresh-token');
    });
  });

  describe('Token Blacklist', () => {
    const { ensureConnection } = require('../../../src/config/services/redis');

    it('blacklistToken should add token to blacklist with default TTL', async () => {
      // Arrange
      const token = 'test-token';
      
      // Act
      await authUtils.blacklistToken(token);

      // Assert
      expect(ensureConnection.setEx).toHaveBeenCalledWith(
        'test:auth:token_blacklist:test-token',
        24 * 60 * 60, // default TTL
        '1'
      );
    });

    it('blacklistToken should add token to blacklist with custom TTL', async () => {
      // Arrange
      const token = 'test-token';
      const ttl = 3600;
      
      // Act
      await authUtils.blacklistToken(token, ttl);

      // Assert
      expect(ensureConnection.setEx).toHaveBeenCalledWith(
        'test:auth:token_blacklist:test-token',
        ttl,
        '1'
      );
    });

    it('isTokenBlacklisted should check if token is in blacklist', async () => {
      // Arrange
      const token = 'test-token';
      ensureConnection.exists.mockResolvedValueOnce(0);
      
      // Act
      const result = await authUtils.isTokenBlacklisted(token);

      // Assert
      expect(ensureConnection.exists).toHaveBeenCalledWith('test:auth:token_blacklist:test-token');
      expect(result).toBe(false);
    });

    it('isTokenBlacklisted should return true if token is in blacklist', async () => {
      // Arrange
      const token = 'blacklisted-token';
      ensureConnection.exists.mockResolvedValueOnce(1);
      
      // Act
      const result = await authUtils.isTokenBlacklisted(token);

      // Assert
      expect(ensureConnection.exists).toHaveBeenCalledWith('test:auth:token_blacklist:blacklisted-token');
      expect(result).toBe(true);
    });
  });
}); 