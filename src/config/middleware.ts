import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './env';
import { logger } from './logger';

export const setupMiddlewares = (app: Application): void => {
  // Middleware dasar
  app.use(
    cors({
      origin: config.urls.frontend,
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
