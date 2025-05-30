import { Request, Response, NextFunction } from 'express';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError } from '../../../src/types/error';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    mockNext = jest.fn() as any;
    
    // Mock console.error to prevent noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle Prisma unique constraint error', () => {
    // Arrange
    const prismaError = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '4.0.0',
      meta: { target: ['email'] },
    });

    // Act
    errorMiddleware(prismaError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Duplicate entry, unique constraint failed',
      details: { target: ['email'] },
    });
  });

  it('should handle general Prisma errors', () => {
    // Arrange
    const prismaError = new PrismaClientKnownRequestError('Some other Prisma error', {
      code: 'P2001',
      clientVersion: '4.0.0',
      meta: { details: 'Record not found' },
    });

    // Act
    errorMiddleware(prismaError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Database error',
      details: { details: 'Record not found' },
    });
  });

  it('should handle JsonWebTokenError', () => {
    // Arrange
    const jwtError = new JsonWebTokenError('Invalid signature');

    // Act
    errorMiddleware(jwtError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid or malformed token',
    });
  });

  it('should handle TokenExpiredError', () => {
    // Arrange
    const tokenExpiredError = new TokenExpiredError('Token expired', new Date());

    // Act
    errorMiddleware(tokenExpiredError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid or malformed token',
    });
  });

  it('should handle AppError with custom status code', () => {
    // Arrange
    const appError = new AppError('Resource not found', 404);

    // Act
    errorMiddleware(appError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Resource not found',
    });
  });

  it('should handle SyntaxError in request body', () => {
    // Arrange
    const syntaxError = new SyntaxError('Unexpected token in JSON');
    Object.defineProperty(syntaxError, 'body', { value: {} });

    // Act
    errorMiddleware(syntaxError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid JSON format',
    });
  });

  it('should handle generic errors as 500 Internal Server Error', () => {
    // Arrange
    const genericError = new Error('Something went wrong');

    // Act
    errorMiddleware(genericError, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      details: 'Something went wrong',
    });
  });

  it('should use generic message if error has no message', () => {
    // Arrange
    const errorWithoutMessage = new Error();
    errorWithoutMessage.message = '';

    // Act
    errorMiddleware(errorWithoutMessage, mockReq as Request, mockRes as Response, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      details: 'Unexpected error occurred',
    });
  });
}); 