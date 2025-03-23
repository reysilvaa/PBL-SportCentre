import { Application } from 'express';
import httpsMiddleware from '../../middlewares/https.middleware';
import {
  helmetMiddleware,
  sanitizeData,
  addSecurityHeaders,
  preventParamPollution,
  apiRateLimiter,
} from '../../middlewares/security.middleware';

export const setupSecurityMiddlewares = (app: Application): void => {
  // Security Middleware
  app.use(httpsMiddleware);
  app.use(helmetMiddleware);
  app.use(addSecurityHeaders);
  app.use(sanitizeData);
  app.use(preventParamPollution);

  // Rate limiter untuk route API
  app.use('/api', apiRateLimiter);
};
