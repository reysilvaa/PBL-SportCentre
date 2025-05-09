import { Request, Response } from 'express';
import { config } from '../config/app/env';
import redisClient from '../config/services/redis';

// ==================== COOKIE MANAGEMENT ====================

/**
 * Mengatur cookie pada response
 * @param res Express response object
 * @param name Nama cookie
 * @param value Nilai cookie
 * @param options Opsi tambahan (opsional)
 */
export const setCookie = (
  res: Response,
  name: string,
  value: string,
  options?: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    signed?: boolean;
    sameSite?: boolean | 'none' | 'lax' | 'strict';
    domain?: string;
    path?: string;
    expires?: Date;
  }
) => {
  // Gabungkan dengan konfigurasi default
  const cookieOptions = {
    maxAge: config.cookies.maxAge,
    httpOnly: config.cookies.httpOnly,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/',
    ...options,
  };

  res.cookie(name, value, cookieOptions);
};

/**
 * Membaca cookie dari request
 * @param req Express request object
 * @param name Nama cookie
 * @param signed Apakah cookie ditandatangani (signed)
 */
export const getCookie = (req: Request, name: string, signed = false): string | undefined => {
  return signed ? req.signedCookies[name] : req.cookies[name];
};

/**
 * Menghapus cookie dari response
 * @param res Express response object
 * @param name Nama cookie
 * @param options Opsi tambahan (opsional)
 */
export const clearCookie = (
  res: Response,
  name: string,
  options?: {
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: boolean | 'none' | 'lax' | 'strict';
  }
) => {
  const cookieOptions = {
    path: '/',
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    ...options,
    // Set expiry ke masa lalu untuk memastikan cookie dihapus
    expires: new Date(0),
  };

  res.clearCookie(name, cookieOptions);
};

// ==================== TOKEN MANAGEMENT ====================

/**
 * Set cookie untuk autentikasi (token)
 * @param res Express response object
 * @param token JWT token
 */
export const setAuthCookie = (res: Response, token: string) => {
  setCookie(res, 'auth_token', token, {
    httpOnly: true, // Untuk keamanan, tidak dapat diakses oleh JavaScript
    signed: true, // Ditandatangani untuk verifikasi
    maxAge: config.cookies.maxAge,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/',
  });
};

/**
 * Mendapatkan token autentikasi dari cookies
 * @param req Express request object
 */
export const getAuthToken = (req: Request): string | undefined => {
  return getCookie(req, 'auth_token', true);
};

/**
 * Menghapus cookie autentikasi
 * @param res Express response object
 */
export const clearAuthCookie = (res: Response) => {
  clearCookie(res, 'auth_token', {
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
  });
};

/**
 * Set refresh token cookie
 * @param res Express response object
 * @param token Refresh token
 */
export const setRefreshTokenCookie = (res: Response, token: string) => {
  setCookie(res, 'refresh_token', token, {
    httpOnly: true,
    signed: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 hari
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/',
  });
};

/**
 * Mendapatkan refresh token dari cookies
 * @param req Express request object
 */
export const getRefreshToken = (req: Request): string | undefined => {
  return getCookie(req, 'refresh_token', true);
};

/**
 * Menghapus refresh token cookie
 * @param res Express response object
 */
export const clearRefreshTokenCookie = (res: Response) => {
  clearCookie(res, 'refresh_token', {
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
  });
};

/**
 * Memeriksa apakah cookie dengan nama tertentu ada
 * @param name Nama cookie yang dicari
 * @returns boolean true jika cookie ada, false jika tidak
 */
export const hasCookie = (name: string): boolean => {
  if (typeof document === 'undefined') {
    return false; // Jika berjalan di server, tidak ada cookie
  }

  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return true;
    }
  }
  return false;
};

/**
 * Cek apakah user memiliki cookie autentikasi
 * @returns boolean true jika ada cookie auth, false jika tidak
 */
export const hasAuthCookie = (): boolean => {
  return hasCookie('auth_token') || hasCookie('refresh_token');
};

// ==================== TOKEN BLACKLIST ====================

// Prefix untuk kunci blacklist token di Redis
const BLACKLIST_PREFIX = 'token_blacklist:';
const DEFAULT_TTL = 24 * 60 * 60; // Default TTL: 24 jam

/**
 * Menambahkan token ke blacklist
 * @param token Token yang akan di-blacklist
 * @param expiryInSeconds Waktu dalam detik token tetap di blacklist (opsional)
 */
export const blacklistToken = async (token: string, expiryInSeconds?: number): Promise<void> => {
  // Gunakan default TTL jika expiryInSeconds tidak diberikan
  const ttl = expiryInSeconds || DEFAULT_TTL;
  try {
    await redisClient.setEx(`${BLACKLIST_PREFIX}${token}`, ttl, '1');
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

/**
 * Memeriksa apakah token ada dalam blacklist
 * @param token Token yang akan diperiksa
 * @returns Boolean
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const exists = await redisClient.exists(`${BLACKLIST_PREFIX}${token}`);
    return exists === 1;
  } catch (error) {
    console.error('Error checking blacklisted token:', error);
    return false;
  }
};

/**
 * Menghapus token dari blacklist
 * @param token Token yang akan dihapus dari blacklist
 * @returns Boolean
 */
export const removeFromBlacklist = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.del(`${BLACKLIST_PREFIX}${token}`);
    return result > 0;
  } catch (error) {
    console.error('Error removing token from blacklist:', error);
    return false;
  }
};
