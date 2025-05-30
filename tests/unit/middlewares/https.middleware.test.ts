import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import httpsMiddleware from '../../../src/middlewares/https.middleware';
import { config } from '../../../src/config/app/env';

// Mock the config module
jest.mock('../../../src/config/app/env', () => ({
  config: {
    isProduction: false,
  },
}));

describe('HTTPS Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    mockReq = {
      secure: false,
      headers: {
        'x-forwarded-proto': 'http',
        'host': 'example.com',
      },
      hostname: 'example.com',
      originalUrl: '/path',
    };
    
    mockRes = {
      redirect: jest.fn(),
    };
    
    mockNext = jest.fn();
    
    // Save original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  it('should call next() when not in production', () => {
    // Arrange - config.isProduction is already false
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should call next() when request is already secure', () => {
    // Arrange
    (config as any).isProduction = true;
    mockReq.secure = true;
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should call next() when x-forwarded-proto is https', () => {
    // Arrange
    (config as any).isProduction = true;
    mockReq.headers['x-forwarded-proto'] = 'https';
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should call next() when hostname is localhost', () => {
    // Arrange
    (config as any).isProduction = true;
    mockReq.hostname = 'localhost';
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should call next() when FORCE_HTTPS is false', () => {
    // Arrange
    (config as any).isProduction = true;
    process.env.FORCE_HTTPS = 'false';
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('should redirect to HTTPS when in production and not secure', () => {
    // Arrange
    (config as any).isProduction = true;
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https://example.com/path');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle missing host header', () => {
    // Arrange
    (config as any).isProduction = true;
    mockReq.headers.host = undefined;
    
    // Act
    httpsMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.redirect).toHaveBeenCalledWith(301, 'https:///path');
    expect(mockNext).not.toHaveBeenCalled();
  });
}); 