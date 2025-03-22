import { Request, Response } from 'express';
import { config } from '../config/env';

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
  },
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
export const getCookie = (
  req: Request,
  name: string,
  signed = false,
): string | undefined => {
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
  },
) => {
  const cookieOptions = {
    path: '/',
    ...options,
  };

  res.clearCookie(name, cookieOptions);
};

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
  clearCookie(res, 'auth_token');
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
  clearCookie(res, 'refresh_token');
};

/**
 * Set cookie untuk preferensi user
 * @param res Express response object
 * @param preferences Object preferensi user
 */
export const setUserPreferencesCookie = (
  res: Response,
  preferences: object,
) => {
  setCookie(res, 'user_preferences', JSON.stringify(preferences), {
    httpOnly: false, // Dapat diakses oleh JavaScript client-side
    signed: false,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 tahun
  });
};

/**
 * Mendapatkan preferensi user dari cookies
 * @param req Express request object
 */
export const getUserPreferences = (req: Request) => {
  const prefCookie = getCookie(req, 'user_preferences');
  if (!prefCookie) return {};

  try {
    return JSON.parse(prefCookie);
  } catch (error) {
    console.error('Error parsing user preferences cookie:', error);
    return {};
  }
};

export default {
  setCookie,
  getCookie,
  clearCookie,
  setAuthCookie,
  getAuthToken,
  clearAuthCookie,
  setRefreshTokenCookie,
  getRefreshToken,
  clearRefreshTokenCookie,
  setUserPreferencesCookie,
  getUserPreferences,
};
