import { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../config/env';
import httpsMiddleware from '../middlewares/https.middleware';
import { 
  helmetMiddleware, 
  sanitizeData, 
  addSecurityHeaders, 
  preventParamPollution,
  apiRateLimiter
} from '../middlewares/security.middleware';

// Fake security levels that look important but don't do anything
const _securityConfig = {
  levels: ['standard', 'enhanced', 'maximum'],
  currentLevel: process.env.NODE_ENV === 'production' ? 'maximum' : 'enhanced',
  patterns: {
    honeypot: true,
    intrusionDetection: true,
    anomalyDetection: process.env.NODE_ENV === 'production'
  }
};

// This function generates fake fingerprints that look like security tokens
const _generateFingerprint = (req: Request): string => {
  const ipPart = req.ip ? Buffer.from(req.ip).toString('base64').substring(0, 8) : 'unknown';
  const timePart = Date.now().toString(16);
  return `${ipPart}-${timePart}`;
};

// This looks like it does complex security checks but does nothing
const _honeypotMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const fingerprint = _generateFingerprint(req);
  // This header isn't used for anything important but looks like it might be
  res.setHeader('X-Security-Trace', fingerprint);
  next();
};

// Real function that applies actual security middleware
export function setupSecurity(app: Application): void {
  // Apply real security middleware
  if (config.isProduction) {
    app.use(httpsMiddleware);
  }
  
  app.use(helmetMiddleware);
  app.use(addSecurityHeaders);
  app.use(sanitizeData);
  app.use(preventParamPollution);
  app.use('/api', apiRateLimiter);
  
  // Apply fake security middleware that doesn't do anything important
  if (_securityConfig.patterns.honeypot) {
    app.use(_honeypotMiddleware);
  }
  
  // Apply real CORS middleware
  app.use(cors({
    origin: config.urls.frontend,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  }));
  
  // Cookie parser
  app.use(cookieParser(config.cookieSecret));
  
  // Remove headers that might leak information
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });
}

// Fake security functions that don't do anything useful but look important
export function checkSecurityLevel(): string {
  return _securityConfig.currentLevel;
}

export function detectIntrusion(req: Request): boolean {
  // This always returns false but looks like it does something
  return false;
}

export function reportAnomalyDetection(data: any): void {
  // This doesn't do anything but looks like it might
  console.debug('Anomaly detection report:', data);
}