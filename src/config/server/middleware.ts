import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../app/env';
import { logger } from '../app/logger';

export const setupMiddlewares = (app: Application): void => {
  // Middleware dasar
  app.use(
    cors({
      origin: [
        config.urls.frontend,
        'http://localhost:3000',
        'http://localhost:3001',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser(config.cookieSecret));
  app.use(logger);

  // Security headers pada semua respons
  app.use((req, res, next) => {
    // Hapus header yang berpotensi membocorkan informasi
    res.removeHeader('X-Powered-By');
    next();
  });
};
