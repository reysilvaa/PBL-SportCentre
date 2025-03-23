import { Request, Response, NextFunction } from 'express';
import { config } from '../config/app/env';

/**
 * Middleware untuk memastikan penggunaan HTTPS di production
 * Redirect HTTP ke HTTPS jika dipanggil melalui HTTP di production
 */
export const httpsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Skip jika:
  // 1. Bukan production
  // 2. Sudah HTTPS
  // 3. Localhost
  // 4. FORCE_HTTPS diset false
  if (
    !config.isProduction ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.hostname === 'localhost' ||
    process.env.FORCE_HTTPS === 'false'
  ) {
    return next();
  }

  // Redirect ke HTTPS
  const host = req.headers.host || '';
  const url = `https://${host}${req.originalUrl}`;
  return res.redirect(301, url);
};

export default httpsMiddleware;
