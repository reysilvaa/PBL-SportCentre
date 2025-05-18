import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../app/env';
import { logger } from '../app/logger';
import { setCacheControlHeaders } from '../../utils/cache.utils';
import { corsConfig } from './cors';

/**
 * Setup middleware dasar untuk aplikasi
 *
 * Catatan:
 * - Middleware cache di sini menangani pengaturan Cache-Control untuk semua respons
 * - Security headers diatur di setupSecurityMiddlewares terpisah
 */
export const setupMiddlewares = (app: Application): void => {
  // Middleware dasar
  app.use(cors(corsConfig()));
  
  // Tambahkan handler untuk preflight OPTIONS requests
  app.options('*', cors(corsConfig()));
  
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser(config.cookieSecret));
  app.use(logger);

  // Cache headers pada semua respons
  app.use((req, res, next) => {
    setCacheControlHeaders(req, res);
    next();
  });
};

/**
 * Setup HTTP caching untuk API routes
 */
export const setupCacheControl = () => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    setCacheControlHeaders(req, res);
    next();
  };
};
