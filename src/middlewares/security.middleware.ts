import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import redisClient from '../config/services/redis';
import { User } from './auth.middleware';
import prisma from '../config/services/database';

// Prefix untuk kunci Redis
const FAILED_BOOKING_PREFIX = 'failed_booking:';
const BLOCKED_USER_PREFIX = 'blocked_user:';
const BLOCKED_IP_PREFIX = 'blocked_ip:';

// Konfigurasi untuk jumlah maksimum percobaan
const MAX_FAILED_BOOKINGS = 10; // Ditingkatkan dari 5 ke 10 booking gagal/pending dalam periode
const BLOCK_USER_TIME = 15 * 60; // Dikurangi dari 30 ke 15 menit (dalam detik)
const BLOCK_IP_TIME = 10 * 60; // Dikurangi dari 15 ke 10 menit (dalam detik)

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
  30,
  'Terlalu banyak percobaan login, coba lagi nanti'
);

// Rate limiter untuk endpoint register
export const registerRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 jam
  15,
  'Terlalu banyak percobaan register, coba lagi nanti'
);

// Rate limiter untuk endpoint booking
export const bookingRateLimiter = createRateLimiter(
  10 * 60 * 1000, // 10 menit
  30,
  'Terlalu banyak percobaan booking, coba lagi nanti'
);

/**
 * Middleware untuk memeriksa apakah pengguna diblokir
 * Fungsi internal untuk penggunaan langsung
 */
const _checkBlockedUser = async (req: User, res: Response, next: NextFunction) => {
  if (!req.user?.id) {
    return next();
  }

  const userId = req.user.id.toString();

  try {
    // Periksa apakah pengguna diblokir
    const userIsBlocked = await redisClient.exists(`${BLOCKED_USER_PREFIX}${userId}`);
    if (userIsBlocked) {
      // Dapatkan sisa waktu blokir
      const ttl = await redisClient.ttl(`${BLOCKED_USER_PREFIX}${userId}`);
      const minutesRemaining = Math.ceil(ttl / 60);

      return res.status(403).json({
        status: false,
        message: `Akun Anda diblokir sementara karena aktivitas mencurigakan. Silakan coba lagi dalam ${minutesRemaining} menit.`,
      });
    }

    // Periksa apakah IP diblokir
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const ipIsBlocked = await redisClient.exists(`${BLOCKED_IP_PREFIX}${clientIP}`);
    if (ipIsBlocked) {
      // Dapatkan sisa waktu blokir
      const ttl = await redisClient.ttl(`${BLOCKED_IP_PREFIX}${clientIP}`);
      const minutesRemaining = Math.ceil(ttl / 60);

      return res.status(403).json({
        status: false,
        message: `Akses diblokir sementara karena aktivitas mencurigakan. Silakan coba lagi dalam ${minutesRemaining} menit.`,
      });
    }

    next();
  } catch (error) {
    console.error('Error checking blocked status:', error);
    next();
  }
};

/**
 * Middleware untuk memeriksa apakah pengguna diblokir
 * Fungsi publik untuk digunakan di Express router
 */
export const checkBlockedUser = (req: Request, res: Response, next: NextFunction) => {
  return _checkBlockedUser(req as User, res, next);
};

/**
 * Melacak booking failed/pending dan memblokir pengguna jika melewati batas
 */
export const trackFailedBooking = async (userId: number, bookingId: number, clientIP: string) => {
  const userKey = `${FAILED_BOOKING_PREFIX}user_${userId}`;
  const ipKey = `${FAILED_BOOKING_PREFIX}ip_${clientIP}`;

  try {
    // Tambah counter untuk user
    let userFailCount = 0;
    const userFailStr = await redisClient.get(userKey);
    if (userFailStr) {
      userFailCount = parseInt(userFailStr);
    }
    userFailCount++;
    await redisClient.setEx(userKey, 60 * 60, userFailCount.toString()); // 1 jam TTL

    // Tambah counter untuk IP
    let ipFailCount = 0;
    const ipFailStr = await redisClient.get(ipKey);
    if (ipFailStr) {
      ipFailCount = parseInt(ipFailStr);
    }
    ipFailCount++;
    await redisClient.setEx(ipKey, 60 * 60, ipFailCount.toString()); // 1 jam TTL

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
      await redisClient.setEx(`${BLOCKED_USER_PREFIX}${userId}`, BLOCK_USER_TIME, '1');

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
      await redisClient.setEx(`${BLOCKED_IP_PREFIX}${clientIP}`, BLOCK_IP_TIME, '1');

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
  } catch (error) {
    console.error('Error tracking failed booking:', error);
    return { userFailCount: 0, ipFailCount: 0 };
  }
};

/**
 * Reset failed booking counter setelah booking berhasil
 */
export const resetFailedBookingCounter = async (userId: number) => {
  try {
    const userKey = `${FAILED_BOOKING_PREFIX}user_${userId}`;
    await redisClient.del(userKey);
  } catch (error) {
    console.error('Error resetting failed booking counter:', error);
  }
};

// Rate limiter untuk API
export const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 menit
  1000, // Ditingkatkan dari 500 ke 1000 permintaan per IP
  'Terlalu banyak permintaan, coba lagi nanti'
);

/**
 * Global Rate Limiter (lebih lembut)
 */
export const globalRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 menit
  2000, // Ditingkatkan dari 1000 ke 2000 permintaan per IP
  'Terlalu banyak permintaan, coba lagi nanti'
);

/**
 * Middleware untuk sanitasi data
 */
export const sanitizeData = (req: Request, res: Response, next: NextFunction) => {
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
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Hapus header yang berpotensi membocorkan informasi
  res.removeHeader('X-Powered-By');

  // Tambahkan security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

/**
 * Middleware untuk mencegah parameter pollution
 */
export const preventParamPollution = (req: Request, res: Response, next: NextFunction) => {
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
