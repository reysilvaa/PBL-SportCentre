import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Middleware untuk memastikan penggunaan HTTPS di production
 * Redirect HTTP ke HTTPS jika dipanggil melalui HTTP di production
 */
export const httpsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip jika bukan production atau jika sudah HTTPS
  if (!config.isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect ke HTTPS
  const host = req.headers.host || '';
  const url = `https://${host}${req.originalUrl}`;
  return res.redirect(301, url);
};

export default httpsMiddleware; 