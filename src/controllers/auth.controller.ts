import { Request, Response } from 'express';
import prisma from '../config/services/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/app/env';
import { registerSchema, loginSchema } from '../zod-schemas/auth.schema';
import { blacklistToken } from '../utils/token-blacklist.utils';
import {
  setAuthCookie,
  clearAuthCookie,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getAuthToken,
} from '../utils/cookies.utils';
import { hashPassword, verifyPassword } from '../utils/password.utils';

// Fungsi untuk generate token
const generateTokens = (user: { id: number; email: string; role: string }) => {
  // Access token (masa aktif pendek)
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  // Refresh token (masa aktif panjang)
  const refreshToken = jwt.sign({ id: user.id }, config.jwtSecret, {
    expiresIn: '30d',
  });

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { email, password, name, role, phone } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: 'Email sudah terdaftar' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    // Generate access dan refresh token
    const { accessToken, refreshToken } = generateTokens(user);

    // Set cookies untuk authentication
    setAuthCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token: accessToken, // Tetap mengembalikan token untuk client yang tidak menggunakan cookies
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // Dapatkan token dari header atau cookie
    const headerToken = req.header('Authorization')?.split(' ')[1];
    const cookieToken = req.signedCookies['auth_token'];

    // Gunakan token yang tersedia
    const token = cookieToken || headerToken;

    // Jika token tersedia, tambahkan ke blacklist
    if (token) {
      try {
        // Decode token untuk mendapatkan waktu expired
        const decoded = jwt.verify(token, config.jwtSecret) as { exp: number };

        // Hitung sisa waktu token (dalam detik)
        const now = Math.floor(Date.now() / 1000);
        const expiryInSeconds = decoded.exp - now;

        // Tambahkan token ke blacklist dengan waktu expired yang sama
        await blacklistToken(
          token,
          expiryInSeconds > 0 ? expiryInSeconds : undefined
        );
      } catch (error) {
        console.error('Error adding token to blacklist:', error);
        // Lanjutkan meskipun ada error dalam menambahkan token ke blacklist
      }
    }

    // Hapus cookies authentication
    clearAuthCookie(res);
    clearRefreshTokenCookie(res);

    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Endpoint untuk refresh token
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Ambil refresh token dari cookies yang signed (ditandatangani)
    const refreshToken = req.signedCookies['refresh_token'];

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token tidak ditemukan' });
      return;
    }

    // Verifikasi refresh token
    try {
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as {
        id: number;
      };

      // Cari user berdasarkan id dari token
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        res.status(401).json({ error: 'User tidak ditemukan' });
        return;
      }

      // Generate token baru
      const { accessToken, refreshToken: newRefreshToken } =
        generateTokens(user);

      // Set cookies baru
      setAuthCookie(res, accessToken);
      setRefreshTokenCookie(res, newRefreshToken);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        token: accessToken,
        user: userWithoutPassword,
      });
    } catch (error) {
      // Token tidak valid atau expired
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res
        .status(401)
        .json({ error: 'Refresh token tidak valid atau sudah expired' });
    }
  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Endpoint untuk memeriksa status autentikasi
export const getAuthStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil token dari cookie atau header
    const headerToken = req.header('Authorization')?.split(' ')[1];
    const cookieToken = getAuthToken(req);
    const token = cookieToken || headerToken;

    if (!token) {
      res.status(401).json({ error: 'Tidak terautentikasi' });
      return;
    }

    try {
      // Verifikasi token
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: number;
        email: string;
        role: string;
      };

      // Ambil data user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        res.status(401).json({ error: 'User tidak ditemukan' });
        return;
      }

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token // Mengembalikan token untuk kompatibilitas dengan client lama
      });
    } catch (error) {
      // Token tidak valid
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
    }
  } catch (error) {
    console.error('Auth Status Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
