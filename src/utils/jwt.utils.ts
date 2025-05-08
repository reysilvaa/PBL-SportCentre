import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/app/env';
import { User } from '@prisma/client';

/**
 * Generate JWT token for user
 * @param user User data
 * @param expiresIn Expiration time
 * @returns JWT token
 */
export const generateToken = (user: Partial<User>, expiresIn = '1h'): string => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  // @ts-ignore ignoring type error for jwt.sign
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
};

/**
 * Verify JWT token
 * @param token JWT token
 * @returns Decoded token payload or null if invalid
 */
export const verifyToken = (token: string): any => {
  try {
    // @ts-ignore ignoring type error for jwt.verify
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Generate refresh token
 * @param user User data
 * @returns Refresh token
 */
export const generateRefreshToken = (user: Partial<User>): string => {
  const payload = {
    id: user.id,
    tokenType: 'refresh',
  };

  // @ts-ignore ignoring type error for jwt.sign
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
};

/**
 * Verify refresh token
 * @param token Refresh token
 * @returns User ID if valid, null if invalid
 */
export const verifyRefreshToken = (token: string): number | null => {
  try {
    // @ts-ignore ignoring type error for jwt.verify
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (decoded.tokenType !== 'refresh') {
      return null;
    }
    return decoded.id;
  } catch (error) {
    return null;
  }
}; 