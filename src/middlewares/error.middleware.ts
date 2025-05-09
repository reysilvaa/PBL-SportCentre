import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error Middleware:', err);

  if (err instanceof PrismaClientKnownRequestError) {
    let message = 'Database error';
    if (err.code === 'P2002') {
      message = 'Duplicate entry, unique constraint failed';
    }
    return res.status(400).json({ error: message, details: err.meta });
  }

  if (err instanceof JsonWebTokenError) {
    return res.status(401).json({ error: 'Invalid or malformed token' });
  }
  if (err instanceof TokenExpiredError) {
    return res.status(401).json({ error: 'Token has expired' });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    details: err.message || 'Unexpected error occurred',
  });
};

export default errorMiddleware;
