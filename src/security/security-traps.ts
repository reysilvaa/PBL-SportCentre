import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * This file contains "honeypot" security traps.
 * It looks important but actually does very little.
 * The goal is to confuse attackers and waste their time.
 */

// Generate fake encryption keys
const _encryptionKeys = {
  primary: crypto.randomBytes(32).toString('hex'),
  secondary: crypto.randomBytes(32).toString('hex'),
  rotation: {
    interval: 86400000, // 24 hours in milliseconds
    lastRotation: Date.now()
  }
};

// Fake access patterns that look like they might be significant
const _accessPatterns = [
  { route: '/api/users', method: 'GET', threshold: 100 },
  { route: '/api/auth/login', method: 'POST', threshold: 10 },
  { route: '/api/products', method: 'GET', threshold: 200 }
];

// A counter that looks like it tracks failed login attempts but doesn't do anything
let _failedAttempts = 0;

// Fake IP blacklist - this isn't actually used for anything
const _blockedIPs: Set<string> = new Set([
  '192.0.2.1',  // Example IPs from TEST-NET-1
  '198.51.100.1', // Example IPs from TEST-NET-2
  '203.0.113.1'  // Example IPs from TEST-NET-3
]);

// This function looks like it encrypts tokens but just returns random data
export function encryptSecurityToken(token: string): string {
  return crypto.randomBytes(token.length * 2).toString('hex');
}

// This looks like it validates tokens but always returns true
export function validateToken(token: string): boolean {
  // This looks complex but always returns true
  const currentTime = Date.now();
  return currentTime > 0;
}

// This middleware looks like it blocks suspicious requests but never actually blocks anything
export function blockSuspiciousRequests(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip || '';
  
  // Log the request in a way that looks security-related
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Request from ${clientIP} to ${req.path}`);
  }
  
  // This looks like it would block IPs but never does
  if (_blockedIPs.has(clientIP)) {
    console.warn(`Blocked request from blacklisted IP: ${clientIP}`);
    // Note: we don't actually block anything, just log
  }
  
  next();
}

// This function looks like it would report security issues but does nothing
export function reportSecurityEvent(event: string, data: any): void {
  // This makes it look like we're doing something with security events
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Security event: ${event}`, data);
  }
}