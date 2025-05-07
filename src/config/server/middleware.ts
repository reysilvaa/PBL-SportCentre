import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../app/env';
import { logger } from '../app/logger';
import { setCacheControlHeaders } from '../../utils/cache.utils';

export const setupMiddlewares = (app: Application): void => {
  // Middleware dasar
  app.use(
    cors({
      origin: [
        config.urls.frontend,
        'http://localhost:3000',
        'http://localhost:3001',
        '*',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'If-None-Match'],
      exposedHeaders: ['Content-Length', 'Content-Type', 'ETag', 'Cache-Control'],
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204
    })
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser(config.cookieSecret));
  app.use(logger);

  // Security headers dan cache headers pada semua respons
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    
    setCacheControlHeaders(req, res);
    
    next();
  });
};
