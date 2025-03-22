import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { User } from './auth.middleware';
import prisma from '../config/database';

// Cache untuk menyimpan percobaan booking yang gagal/pending per user dan IP
const failedBookingCache = new NodeCache({
  stdTTL: 60 * 60, // 1 jam
  checkperiod: 10 * 60, // Periksa setiap 10 menit
  useClones: false,
});

// Cache untuk menyimpan pengguna dan IP yang diblokir
const blockedUsersCache = new NodeCache({
  stdTTL: 30 * 60, // 30 menit block by default
  checkperiod: 5 * 60, // Periksa setiap 5 menit
  useClones: false,
});

const blockedIPsCache = new NodeCache({
  stdTTL: 15 * 60, // 15 menit block by default
  checkperiod: 5 * 60, // Periksa setiap 5 menit
  useClones: false,
});

// Konfigurasi untuk jumlah maksimum percobaan
const MAX_FAILED_BOOKINGS = 5; // Maksimum booking gagal/pending dalam periode
const BLOCK_USER_TIME = 30 * 60; // Block user selama 30 menit (dalam detik)
const BLOCK_IP_TIME = 15 * 60; // Block IP selama 15 menit (dalam detik)

/**
 * Fungsi helper untuk membuat rate limiter dengan konfigurasi yang umum
 */
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    message: {
      status: false,
      message,
    },
  });
};

// Rate limiter untuk endpoint login
export const loginRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 menit
  10, // 10 permintaan per IP
  'Terlalu banyak percobaan login, coba lagi nanti',
);

// Rate limiter untuk endpoint register
export const registerRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 jam
  5, // 5 permintaan per IP
  'Terlalu banyak percobaan register, coba lagi nanti',
);

// Rate limiter untuk endpoint booking
export const bookingRateLimiter = createRateLimiter(
  10 * 60 * 1000, // 10 menit
  10, // 10 permintaan per IP
  'Terlalu banyak percobaan booking, coba lagi nanti',
);

/**
 * Middleware untuk memeriksa apakah pengguna diblokir
 * Fungsi internal untuk penggunaan langsung
 */
const _checkBlockedUser = (req: User, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return next();
  }

  const userId = req.user.id.toString();

  // Periksa apakah pengguna diblokir
  if (blockedUsersCache.has(userId)) {
    const remainingTime = blockedUsersCache.getTtl(userId) || 0;
    const minutesRemaining = Math.ceil(
      (remainingTime - Date.now()) / 1000 / 60,
    );

    return res.status(403).json({
      status: false,
      message: `Akun Anda diblokir sementara karena aktivitas mencurigakan. Silakan coba lagi dalam ${minutesRemaining} menit.`,
    });
  }

  // Periksa apakah IP diblokir
  const clientIP = req.ip || req.socket.remoteAddress || '';
  if (blockedIPsCache.has(clientIP)) {
    const remainingTime = blockedIPsCache.getTtl(clientIP) || 0;
    const minutesRemaining = Math.ceil(
      (remainingTime - Date.now()) / 1000 / 60,
    );

    return res.status(403).json({
      status: false,
      message: `Akses diblokir sementara karena aktivitas mencurigakan. Silakan coba lagi dalam ${minutesRemaining} menit.`,
    });
  }

  next();
};

/**
 * Middleware untuk memeriksa apakah pengguna diblokir
 * Fungsi publik untuk digunakan di Express router
 */
export const checkBlockedUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  return _checkBlockedUser(req as User, res, next);
};

/**
 * Melacak booking failed/pending dan memblokir pengguna jika melewati batas
 */
export const trackFailedBooking = async (
  userId: number,
  bookingId: number,
  clientIP: string,
) => {
  const userKey = `user_${userId}`;
  const ipKey = `ip_${clientIP}`;

  // Tambah counter untuk user
  let userFailCount = failedBookingCache.get<number>(userKey) || 0;
  userFailCount++;
  failedBookingCache.set(userKey, userFailCount);

  // Tambah counter untuk IP
  let ipFailCount = failedBookingCache.get<number>(ipKey) || 0;
  ipFailCount++;
  failedBookingCache.set(ipKey, ipFailCount);

  // Log ke database (opsional)
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'FAILED_BOOKING',
        details: JSON.stringify({
          bookingId,
          ipAddress: clientIP,
          failCount: userFailCount,
        }),
      },
    });
  } catch (error) {
    console.error('Error logging failed booking:', error);
  }

  // Jika melewati batas, blokir user dan IP
  if (userFailCount >= MAX_FAILED_BOOKINGS) {
    blockedUsersCache.set(`${userId}`, true, BLOCK_USER_TIME);

    // Log pemblokiran ke database (opsional)
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'USER_BLOCKED',
          details: JSON.stringify({
            reason: 'Terlalu banyak booking gagal/pending',
            blockDuration: BLOCK_USER_TIME,
          }),
        },
      });
    } catch (error) {
      console.error('Error logging user block:', error);
    }
  }

  if (ipFailCount >= MAX_FAILED_BOOKINGS) {
    blockedIPsCache.set(clientIP, true, BLOCK_IP_TIME);

    // Log pemblokiran IP ke database (opsional)
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'IP_BLOCKED',
          details: JSON.stringify({
            ipAddress: clientIP,
            reason: 'Terlalu banyak booking gagal/pending',
            blockDuration: BLOCK_IP_TIME,
          }),
        },
      });
    } catch (error) {
      console.error('Error logging IP block:', error);
    }
  }

  return { userFailCount, ipFailCount };
};

/**
 * Reset failed booking counter setelah booking berhasil
 */
export const resetFailedBookingCounter = (userId: number) => {
  const userKey = `user_${userId}`;
  failedBookingCache.del(userKey);
};

// Rate limiter untuk API
export const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 menit
  100, // 100 permintaan per IP
  'Terlalu banyak permintaan, coba lagi nanti',
);

/**
 * Global Rate Limiter (lebih lembut)
 */
export const globalRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 menit
  500, // 500 permintaan per IP
  'Terlalu banyak permintaan, coba lagi nanti',
);

/**
 * Middleware untuk sanitasi data
 */
export const sanitizeData = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.body) {
    // Fungsi rekursif untuk sanitasi objek
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
      }

      const sanitized: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Sanitasi string
          sanitized[key] = value
            .replace(/[<>]/g, '') // Hapus < dan > untuk mencegah HTML injection
            .trim(); // Hapus whitespace di awal dan akhir
        } else if (typeof value === 'object' && value !== null) {
          // Sanitasi objek bersarang
          sanitized[key] = sanitizeObject(value);
        } else {
          // Lewati tipe data lain
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Middleware untuk menambahkan security headers
 */
export const addSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Hapus header yang berpotensi membocorkan informasi
  res.removeHeader('X-Powered-By');

  // Tambahkan security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Tambahkan Cache-Control untuk konten statis
  if (req.method === 'GET') {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
  }

  next();
};

/**
 * Middleware untuk mencegah parameter pollution
 */
export const preventParamPollution = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      // Jika parameter query adalah array, ambil nilai terakhir saja
      if (Array.isArray(value)) {
        req.query[key] = value[value.length - 1];
      }
    }
  }

  next();
};

/**
 * Middleware untuk helmet (headers keamanan)
 */
import helmet from 'helmet';
export const helmetMiddleware = helmet();

export default {
  loginRateLimiter,
  registerRateLimiter,
  bookingRateLimiter,
  checkBlockedUser,
  trackFailedBooking,
  resetFailedBookingCounter,
  apiRateLimiter,
  globalRateLimiter,
  sanitizeData,
  addSecurityHeaders,
  preventParamPollution,
  helmetMiddleware,
};
