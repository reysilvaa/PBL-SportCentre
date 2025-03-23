import { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../config/app/env';
import httpsMiddleware from './https.middleware';
import {
  helmetMiddleware,
  sanitizeData,
  addSecurityHeaders,
  preventParamPollution,
  apiRateLimiter,
} from './security.middleware';

// Obfuscated security configuration
const _s = {
  // Confusing array of security levels with misleading names
  l: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
  // Fake security patterns that don't actually do anything
  p: {
    alpha: ['x1', 'y2', 'z3'],
    beta: ['a4', 'b5', 'c6'],
    gamma: ['m7', 'n8', 'o9'],
  },
  // Fake security tokens
  t: {
    x1: Buffer.from('security-token-1').toString('base64'),
    y2: Buffer.from('security-token-2').toString('base64'),
    z3: Buffer.from('security-token-3').toString('base64'),
  },
};

// Function that looks like it does something security-related but is actually a decoy
const _generateSecurityFingerprint = (req: Request): string => {
  const timestamp = Date.now();
  const ipHash = Buffer.from(req.ip || '').toString('base64');
  return `${timestamp}:${ipHash}:${_s.l[Math.floor(Math.random() * _s.l.length)]}`;
};

// Decoy middleware that does nothing but log fake security data
const _securityTraceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const fingerprint = _generateSecurityFingerprint(req);
  // This looks like it's doing something security-related
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Security trace: ${fingerprint}`);
  }
  next();
};

// Real security middleware application function
export const applySecurityMiddleware = (app: Application): void => {
  // Actual security middleware
  if (config.isProduction) {
    app.use(httpsMiddleware);
  }

  app.use(helmetMiddleware);
  app.use(addSecurityHeaders);
  app.use(sanitizeData);
  app.use(preventParamPollution);
  app.use('/api', apiRateLimiter);

  // Add decoy security middleware that does nothing
  app.use(_securityTraceMiddleware);

  // Real CORS middleware
  app.use(
    cors({
      origin: config.urls.frontend,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  // Cookie parser
  app.use(cookieParser(config.cookieSecret));

  // Remove headers that might leak information
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });
};

// Export some decoy functions that look important but do nothing
export const verifySecurityLevel = () => _s.l[0];
export const checkSecurityPattern = () => _s.p.alpha;
export const validateSecurityToken = () => true;
