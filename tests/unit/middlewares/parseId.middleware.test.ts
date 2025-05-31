import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { parseIds } from '../../../src/middlewares/parseId.middleware';

describe('Parse ID Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  it('should parse valid integer fields', () => {
    // Arrange
    mockReq.body = {
      userId: '123',
      fieldId: '456',
      branchId: '789',
      typeId: '42',
      ownerId: '101',
      rating: '5',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockReq.body).toEqual({
      userId: 123,
      fieldId: 456,
      branchId: 789,
      typeId: 42,
      ownerId: 101,
      rating: 5,
    });
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should not modify non-ID fields', () => {
    // Arrange
    mockReq.body = {
      userId: '123',
      name: 'Test User',
      email: 'test@example.com',
      fieldId: '456',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockReq.body).toEqual({
      userId: 123,
      name: 'Test User',
      email: 'test@example.com',
      fieldId: 456,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not modify fields that are already numbers', () => {
    // Arrange
    mockReq.body = {
      userId: 123,
      fieldId: 456,
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockReq.body).toEqual({
      userId: 123,
      fieldId: 456,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not modify fields that are not present', () => {
    // Arrange
    mockReq.body = {
      name: 'Test User',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockReq.body).toEqual({
      name: 'Test User',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 400 error for invalid userId', () => {
    // Arrange
    mockReq.body = {
      userId: 'not-a-number',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'userId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 error for invalid fieldId', () => {
    // Arrange
    mockReq.body = {
      fieldId: 'invalid',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'fieldId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 error for invalid branchId', () => {
    // Arrange
    mockReq.body = {
      branchId: 'invalid',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'branchId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 error for invalid typeId', () => {
    // Arrange
    mockReq.body = {
      typeId: 'invalid',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'typeId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 error for invalid ownerId', () => {
    // Arrange
    mockReq.body = {
      ownerId: 'invalid',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'ownerId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 error for invalid rating', () => {
    // Arrange
    mockReq.body = {
      rating: 'invalid',
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'rating must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should stop parsing after first invalid field', () => {
    // Arrange
    mockReq.body = {
      userId: 'invalid',
      fieldId: '456', // This shouldn't be parsed as we should stop after userId
    };
    
    // Act
    parseIds(mockReq as Request, mockRes as Response, mockNext);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'userId must be a valid integer' });
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockReq.body.fieldId).toBe('456'); // Should remain a string
  });
}); 